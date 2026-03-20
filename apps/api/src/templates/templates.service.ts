import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { buildEmailWithCompliance } from '../mail/compliance-email.util';
import type { ContactWithId } from '../mail/compliance-email.util';
import type { MailProvider } from '../mail/mail-provider.interface';
import { MAIL_PROVIDER } from '../mail/mail.types';
import { EntitlementsService } from '../billing/entitlements.service';
import { UsageService } from '../billing/usage.service';
import { PrismaService } from '../prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { TestSendDto } from './dto/test-send.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

const LIST_SELECT = {
  id: true,
  name: true,
  subject: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EmailTemplateSelect;

const DETAIL_SELECT = {
  id: true,
  name: true,
  subject: true,
  html: true,
  text: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EmailTemplateSelect;

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAIL_PROVIDER) private readonly mail: MailProvider,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementsService,
    private readonly usage: UsageService,
  ) {}

  async create(workspaceId: string, dto: CreateTemplateDto) {
    return this.prisma.emailTemplate.create({
      data: {
        workspaceId,
        name: dto.name.trim(),
        subject: dto.subject.trim(),
        html: dto.html,
        text: dto.text?.trim() || null,
      },
      select: DETAIL_SELECT,
    });
  }

  async list(workspaceId: string) {
    return this.prisma.emailTemplate.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: LIST_SELECT,
    });
  }

  async getById(workspaceId: string, id: string) {
    const row = await this.prisma.emailTemplate.findFirst({
      where: { id, workspaceId },
      select: DETAIL_SELECT,
    });
    if (!row) {
      throw new NotFoundException('Template not found');
    }
    return row;
  }

  async update(workspaceId: string, id: string, dto: UpdateTemplateDto) {
    await this.getById(workspaceId, id);

    const hasPatch =
      dto.name !== undefined ||
      dto.subject !== undefined ||
      dto.html !== undefined ||
      dto.text !== undefined;

    if (!hasPatch) {
      return this.getById(workspaceId, id);
    }

    const data: Prisma.EmailTemplateUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.subject !== undefined) {
      data.subject = dto.subject.trim();
    }
    if (dto.html !== undefined) {
      data.html = dto.html;
    }
    if (dto.text !== undefined) {
      data.text = dto.text === null || dto.text === '' ? null : dto.text;
    }

    return this.prisma.emailTemplate.update({
      where: { id },
      data,
      select: DETAIL_SELECT,
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.getById(workspaceId, id);

    const used = await this.prisma.campaign.count({
      where: { workspaceId, templateId: id },
    });
    if (used > 0) {
      throw new ConflictException('Template is used by campaigns');
    }

    await this.prisma.emailTemplate.delete({ where: { id } });
    return { ok: true };
  }

  async testSend(workspaceId: string, id: string, dto: TestSendDto) {
    const template = await this.getById(workspaceId, id);
    const emailNorm = dto.email.toLowerCase().trim();

    const existing = await this.prisma.contact.findFirst({
      where: { workspaceId, email: emailNorm },
    });

    const contact: ContactWithId =
      existing ??
      ({
        id: '',
        email: emailNorm,
        firstName: null,
        lastName: null,
        company: null,
        phone: null,
        tags: [],
      } as ContactWithId);

    const secret = this.config.get<string>('UNSUBSCRIBE_SECRET');
    const publicWebUrl = this.config.get<string>('PUBLIC_WEB_URL');
    const ttlRaw = this.config.get<string>('UNSUBSCRIBE_TOKEN_TTL_DAYS');
    const ttlNum = ttlRaw ? Number(ttlRaw) : NaN;

    const { subject, html, text } = buildEmailWithCompliance(
      template.subject,
      template.html,
      template.text,
      contact,
      workspaceId,
      {
        unsubscribeSecret: secret || undefined,
        publicWebUrl: publicWebUrl || undefined,
        unsubscribeTtlDays: Number.isFinite(ttlNum) && ttlNum > 0 ? ttlNum : undefined,
      },
      dto.sampleVariables,
    );

    await this.mail.send({
      to: emailNorm,
      subject,
      html,
      text,
    });

    await this.usage.recordEmailsSent(workspaceId, 1);

    return { ok: true, to: dto.email };
  }
}
