import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContactStatus, Prisma } from '@prisma/client';
import { isEmail } from 'class-validator';
import { parse } from 'csv-parse/sync';
import { buildContactWhere } from '../common/contact-filter.util';
import { EntitlementsService } from '../billing/entitlements.service';
import { PrismaService } from '../prisma.service';
import { SequenceLifecycleService } from '../sequences/sequence-lifecycle.service';
import { UpdateContactDto } from './dto/update-contact.dto';

const PUBLIC_CONTACT_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  company: true,
  phone: true,
  status: true,
  tags: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ContactSelect;

type PublicContact = Prisma.ContactGetPayload<{ select: typeof PUBLIC_CONTACT_SELECT }>;

function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, '');
}

type CsvFieldKey = 'email' | 'firstName' | 'lastName' | 'company' | 'phone' | 'tags';

const HEADER_MAP: Record<string, CsvFieldKey> = {
  email: 'email',
  'e-mail': 'email',
  mail: 'email',
  firstname: 'firstName',
  first_name: 'firstName',
  first: 'firstName',
  lastname: 'lastName',
  last_name: 'lastName',
  last: 'lastName',
  company: 'company',
  organization: 'company',
  org: 'company',
  phone: 'phone',
  telephone: 'phone',
  mobile: 'phone',
  tags: 'tags',
  tag: 'tags',
  labels: 'tags',
};

function normalizeTags(raw?: string): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))];
}

function mergeCsvRow(row: Record<string, string>): Partial<Record<CsvFieldKey, string>> {
  const merged: Partial<Record<CsvFieldKey, string>> = {};
  for (const [key, value] of Object.entries(row)) {
    const field = HEADER_MAP[normalizeHeader(key)];
    if (field) {
      merged[field] = value;
    }
  }
  return merged;
}

function fieldsPresentInCsv(sampleRow: Record<string, string>): Set<CsvFieldKey> {
  const present = new Set<CsvFieldKey>();
  for (const key of Object.keys(sampleRow)) {
    const field = HEADER_MAP[normalizeHeader(key)];
    if (field) {
      present.add(field);
    }
  }
  return present;
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequenceLifecycle: SequenceLifecycleService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async importCsv(workspaceId: string, file: Express.Multer.File): Promise<{
    inserted: number;
    updated: number;
    skipped: number;
    errors: { line: number; message: string }[];
  }> {
    let text: string;
    try {
      text = file.buffer.toString('utf8');
    } catch {
      throw new BadRequestException('Unable to read file');
    }

    let records: Record<string, string>[];
    try {
      records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as Record<string, string>[];
    } catch {
      throw new BadRequestException('Invalid CSV format');
    }

    if (!records.length) {
      throw new BadRequestException('CSV has no data rows');
    }

    const present = fieldsPresentInCsv(records[0]);
    if (!present.has('email')) {
      throw new BadRequestException('CSV must include an email column');
    }

    const seenForQuota = new Set<string>();
    const uniqueNewCandidates: string[] = [];
    for (let i = 0; i < records.length; i++) {
      const merged = mergeCsvRow(records[i]);
      const emailRaw = merged.email?.trim();
      if (!emailRaw || !isEmail(emailRaw)) {
        continue;
      }
      const email = emailRaw.toLowerCase();
      if (seenForQuota.has(email)) {
        continue;
      }
      seenForQuota.add(email);
      uniqueNewCandidates.push(email);
    }

    if (uniqueNewCandidates.length) {
      const existingRows = await this.prisma.contact.findMany({
        where: { workspaceId, email: { in: uniqueNewCandidates } },
        select: { email: true },
      });
      const wouldInsert = uniqueNewCandidates.length - existingRows.length;
      await this.entitlements.assertCanCreateContacts(workspaceId, wouldInsert);
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { line: number; message: string }[] = [];
    const seenInFile = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      const line = i + 2;
      const merged = mergeCsvRow(records[i]);
      const emailRaw = merged.email?.trim();

      if (!emailRaw) {
        errors.push({ line, message: 'Missing email' });
        continue;
      }

      if (!isEmail(emailRaw)) {
        errors.push({ line, message: 'Invalid email' });
        continue;
      }

      const email = emailRaw.toLowerCase();

      if (seenInFile.has(email)) {
        skipped++;
        continue;
      }
      seenInFile.add(email);

      const nextTags = present.has('tags') ? normalizeTags(merged.tags) : undefined;
      const nextFirst = present.has('firstName') ? merged.firstName?.trim() || null : undefined;
      const nextLast = present.has('lastName') ? merged.lastName?.trim() || null : undefined;
      const nextCompany = present.has('company') ? merged.company?.trim() || null : undefined;
      const nextPhone = present.has('phone') ? merged.phone?.trim() || null : undefined;

      const existing = await this.prisma.contact.findUnique({
        where: { workspaceId_email: { workspaceId, email } },
      });

      if (!existing) {
        await this.prisma.contact.create({
          data: {
            workspaceId,
            email,
            firstName: nextFirst ?? null,
            lastName: nextLast ?? null,
            company: nextCompany ?? null,
            phone: nextPhone ?? null,
            tags: nextTags ?? [],
            status: ContactStatus.SUBSCRIBED,
          },
        });
        inserted++;
        continue;
      }

      const mergedFirst = nextFirst !== undefined ? nextFirst : existing.firstName;
      const mergedLast = nextLast !== undefined ? nextLast : existing.lastName;
      const mergedCompany = nextCompany !== undefined ? nextCompany : existing.company;
      const mergedPhone = nextPhone !== undefined ? nextPhone : existing.phone;
      const mergedTags = nextTags !== undefined ? nextTags : existing.tags;

      const unchanged =
        mergedFirst === existing.firstName &&
        mergedLast === existing.lastName &&
        mergedCompany === existing.company &&
        mergedPhone === existing.phone &&
        JSON.stringify(mergedTags) === JSON.stringify(existing.tags);

      if (unchanged) {
        skipped++;
        continue;
      }

      await this.prisma.contact.update({
        where: { id: existing.id },
        data: {
          firstName: mergedFirst,
          lastName: mergedLast,
          company: mergedCompany,
          phone: mergedPhone,
          tags: mergedTags,
        },
      });
      updated++;
    }

    return { inserted, updated, skipped, errors };
  }

  async list(
    workspaceId: string,
    query: ListParams,
  ): Promise<{ items: PublicContact[]; total: number; page: number; pageSize: number }> {
    const page = query.page != null && query.page > 0 ? query.page : 1;
    const pageSize =
      query.pageSize != null && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const where = buildContactWhere(workspaceId, {
      query: query.query,
      tag: query.tag,
    });

    const [total, items] = await this.prisma.$transaction([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: PUBLIC_CONTACT_SELECT,
      }),
    ]);

    return { items, total, page, pageSize };
  }

  async update(workspaceId: string, id: string, dto: UpdateContactDto): Promise<PublicContact> {
    const existing = await this.prisma.contact.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Contact not found');
    }

    const hasPatch =
      dto.firstName !== undefined ||
      dto.lastName !== undefined ||
      dto.company !== undefined ||
      dto.phone !== undefined ||
      dto.tags !== undefined;

    if (!hasPatch) {
      throw new BadRequestException('No fields to update');
    }

    const data: Prisma.ContactUpdateInput = {};

    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName?.trim() || null;
    }
    if (dto.lastName !== undefined) {
      data.lastName = dto.lastName?.trim() || null;
    }
    if (dto.company !== undefined) {
      data.company = dto.company?.trim() || null;
    }
    if (dto.phone !== undefined) {
      data.phone = dto.phone?.trim() || null;
    }
    if (dto.tags !== undefined) {
      data.tags = [...new Set(dto.tags.map((t) => t.trim()).filter(Boolean))];
    }

    return this.prisma.contact.update({
      where: { id },
      data,
      select: PUBLIC_CONTACT_SELECT,
    });
  }

  async unsubscribe(workspaceId: string, id: string): Promise<PublicContact> {
    const existing = await this.prisma.contact.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Contact not found');
    }

    const updated = await this.prisma.contact.update({
      where: { id },
      data: { status: ContactStatus.UNSUBSCRIBED },
      select: PUBLIC_CONTACT_SELECT,
    });
    await this.sequenceLifecycle.cancelEnrollmentsForContact(id);
    return updated;
  }
}

interface ListParams {
  query?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}
