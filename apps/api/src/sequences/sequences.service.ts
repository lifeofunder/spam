import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContactStatus,
  Prisma,
  SequenceEnrollmentStatus,
  SequenceStatus,
} from '@prisma/client';
import { EntitlementsService } from '../billing/entitlements.service';
import { PrismaService } from '../prisma.service';
import { SequenceJobSchedulerService } from './sequence-job-scheduler.service';
import { SequenceLifecycleService } from './sequence-lifecycle.service';
import { CreateSequenceDto } from './dto/create-sequence.dto';
import { EnrollSequenceDto } from './dto/enroll-sequence.dto';
import { UpdateSequenceDto } from './dto/update-sequence.dto';
import { getFirstStep, sortStepsByOrder } from './sequence-step-plan.util';

const LIST_SEQ = {
  id: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { steps: true, enrollments: true } },
} satisfies Prisma.SequenceSelect;

@Injectable()
export class SequencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SequenceJobSchedulerService,
    private readonly lifecycle: SequenceLifecycleService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private validateUniqueOrders(orders: number[]): void {
    const set = new Set(orders);
    if (set.size !== orders.length) {
      throw new BadRequestException('Step orders must be unique');
    }
  }

  private async assertTemplatesInWorkspace(
    workspaceId: string,
    templateIds: string[],
  ): Promise<void> {
    const uniq = [...new Set(templateIds)];
    const n = await this.prisma.emailTemplate.count({
      where: { workspaceId, id: { in: uniq } },
    });
    if (n !== uniq.length) {
      throw new BadRequestException('One or more templates not found in workspace');
    }
  }

  async create(workspaceId: string, dto: CreateSequenceDto) {
    await this.entitlements.assertMarketingAllowed(workspaceId);

    const orders = dto.steps.map((s) => s.order);
    this.validateUniqueOrders(orders);
    await this.assertTemplatesInWorkspace(
      workspaceId,
      dto.steps.map((s) => s.templateId),
    );

    return this.prisma.$transaction(async (tx) => {
      const seq = await tx.sequence.create({
        data: {
          workspaceId,
          name: dto.name.trim(),
          status: SequenceStatus.DRAFT,
        },
      });
      const sorted = sortStepsByOrder(dto.steps);
      for (const s of sorted) {
        await tx.sequenceStep.create({
          data: {
            sequenceId: seq.id,
            order: s.order,
            templateId: s.templateId,
            delayMinutes: s.delayMinutes,
          },
        });
      }
      return tx.sequence.findUniqueOrThrow({
        where: { id: seq.id },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async list(workspaceId: string) {
    return this.prisma.sequence.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      select: LIST_SEQ,
    });
  }

  async getById(workspaceId: string, id: string) {
    const row = await this.prisma.sequence.findFirst({
      where: { id, workspaceId },
      include: { steps: { orderBy: { order: 'asc' }, include: { template: { select: { id: true, name: true, subject: true } } } } },
    });
    if (!row) {
      throw new NotFoundException('Sequence not found');
    }
    return row;
  }

  async update(workspaceId: string, id: string, dto: UpdateSequenceDto) {
    await this.entitlements.assertMarketingAllowed(workspaceId);

    const existing = await this.prisma.sequence.findFirst({
      where: { id, workspaceId },
      select: { status: true },
    });
    if (!existing) {
      throw new NotFoundException('Sequence not found');
    }
    if (existing.status !== SequenceStatus.DRAFT) {
      throw new ConflictException('Only draft sequences can be edited');
    }

    if (dto.steps?.length) {
      const orders = dto.steps.map((s) => s.order);
      this.validateUniqueOrders(orders);
      await this.assertTemplatesInWorkspace(
        workspaceId,
        dto.steps.map((s) => s.templateId),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.name !== undefined) {
        await tx.sequence.update({
          where: { id },
          data: { name: dto.name.trim() },
        });
      }
      if (dto.steps) {
        await tx.sequenceStep.deleteMany({ where: { sequenceId: id } });
        const sorted = sortStepsByOrder(dto.steps);
        for (const s of sorted) {
          await tx.sequenceStep.create({
            data: {
              sequenceId: id,
              order: s.order,
              templateId: s.templateId,
              delayMinutes: s.delayMinutes,
            },
          });
        }
      }
      return tx.sequence.findUniqueOrThrow({
        where: { id },
        include: { steps: { orderBy: { order: 'asc' }, include: { template: { select: { id: true, name: true, subject: true } } } } },
      });
    });
  }

  async activate(workspaceId: string, id: string) {
    const row = await this.prisma.sequence.findFirst({
      where: { id, workspaceId },
      include: { steps: true },
    });
    if (!row) {
      throw new NotFoundException('Sequence not found');
    }
    if (row.status !== SequenceStatus.DRAFT) {
      throw new ConflictException('Sequence is not a draft');
    }
    if (!row.steps.length) {
      throw new BadRequestException('Sequence has no steps');
    }

    await this.entitlements.assertMarketingAllowed(workspaceId);
    await this.entitlements.assertCanActivateSequence(workspaceId);

    return this.prisma.sequence.update({
      where: { id },
      data: { status: SequenceStatus.ACTIVE },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async archive(workspaceId: string, id: string) {
    const row = await this.prisma.sequence.findFirst({
      where: { id, workspaceId },
      select: { id: true, status: true },
    });
    if (!row) {
      throw new NotFoundException('Sequence not found');
    }
    if (row.status === SequenceStatus.ARCHIVED) {
      return this.prisma.sequence.findUniqueOrThrow({
        where: { id },
        include: { steps: { orderBy: { order: 'asc' } } },
      });
    }

    await this.lifecycle.cancelActiveEnrollmentsForSequence(id);
    return this.prisma.sequence.update({
      where: { id },
      data: { status: SequenceStatus.ARCHIVED },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async enroll(workspaceId: string, sequenceId: string, dto: EnrollSequenceDto) {
    await this.entitlements.assertMarketingAllowed(workspaceId);

    const sequence = await this.prisma.sequence.findFirst({
      where: { id: sequenceId, workspaceId },
      include: { steps: true },
    });
    if (!sequence) {
      throw new NotFoundException('Sequence not found');
    }
    if (sequence.status !== SequenceStatus.ACTIVE) {
      throw new ConflictException('Sequence must be ACTIVE to enroll contacts');
    }

    const first = getFirstStep(sequence.steps);
    if (!first) {
      throw new BadRequestException('Sequence has no steps');
    }

    const uniqueContactIds = [...new Set(dto.contactIds)];
    const contacts = await this.prisma.contact.findMany({
      where: {
        id: { in: uniqueContactIds },
        workspaceId,
        status: ContactStatus.SUBSCRIBED,
      },
      select: { id: true },
    });
    if (contacts.length !== uniqueContactIds.length) {
      throw new BadRequestException(
        'All contacts must exist in the workspace and be SUBSCRIBED',
      );
    }

    const results: { contactId: string; enrollmentId: string; skipped?: boolean }[] = [];

    for (const contactId of uniqueContactIds) {
      const existing = await this.prisma.sequenceEnrollment.findUnique({
        where: {
          sequenceId_contactId: { sequenceId, contactId },
        },
      });
      if (existing) {
        results.push({ contactId, enrollmentId: existing.id, skipped: true });
        continue;
      }

      const enrollment = await this.prisma.sequenceEnrollment.create({
        data: {
          sequenceId,
          contactId,
          workspaceId,
          status: SequenceEnrollmentStatus.ACTIVE,
          currentStepOrder: first.order,
          nextRunAt: new Date(Date.now() + first.delayMinutes * 60_000),
        },
      });

      const delayMs = first.delayMinutes * 60_000;
      const jobId = await this.scheduler.scheduleStepSend(
        {
          enrollmentId: enrollment.id,
          workspaceId,
          stepOrder: first.order,
        },
        delayMs,
      );

      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: { pendingJobId: jobId },
      });

      results.push({ contactId, enrollmentId: enrollment.id });
    }

    return { enrolled: results.filter((r) => !r.skipped).length, results };
  }

  async listEnrollments(
    workspaceId: string,
    sequenceId: string,
    page = 1,
    pageSize = 20,
  ) {
    const seq = await this.prisma.sequence.findFirst({
      where: { id: sequenceId, workspaceId },
      select: { id: true },
    });
    if (!seq) {
      throw new NotFoundException('Sequence not found');
    }

    const take = Math.min(100, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;

    const where = { workspaceId, sequenceId };

    const [total, rows] = await Promise.all([
      this.prisma.sequenceEnrollment.count({ where }),
      this.prisma.sequenceEnrollment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          contact: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const ids = rows.map((r) => r.id);
    const events =
      ids.length === 0
        ? []
        : await this.prisma.messageEvent.findMany({
            where: { sequenceEnrollmentId: { in: ids } },
            orderBy: { createdAt: 'desc' },
            select: {
              sequenceEnrollmentId: true,
              sequenceStepOrder: true,
              status: true,
              createdAt: true,
              email: true,
            },
            take: 400,
          });

    const recentByEnrollment = new Map<
      string,
      { sequenceStepOrder: number | null; status: string; createdAt: Date; email: string }[]
    >();
    for (const e of events) {
      if (!e.sequenceEnrollmentId) {
        continue;
      }
      const arr = recentByEnrollment.get(e.sequenceEnrollmentId) ?? [];
      if (arr.length < 5) {
        arr.push({
          sequenceStepOrder: e.sequenceStepOrder,
          status: e.status,
          createdAt: e.createdAt,
          email: e.email,
        });
        recentByEnrollment.set(e.sequenceEnrollmentId, arr);
      }
    }

    return {
      page,
      pageSize: take,
      total,
      items: rows.map((r) => ({
        ...r,
        recentMessageEvents: recentByEnrollment.get(r.id) ?? [],
      })),
    };
  }
}
