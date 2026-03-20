import { Injectable, Logger } from '@nestjs/common';
import { SequenceEnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SequenceJobSchedulerService } from './sequence-job-scheduler.service';

@Injectable()
export class SequenceLifecycleService {
  private readonly logger = new Logger(SequenceLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SequenceJobSchedulerService,
  ) {}

  /** Unsubscribe / bounce / manual: stop all active sequence runs for a contact. */
  async cancelEnrollmentsForContact(contactId: string): Promise<void> {
    const list = await this.prisma.sequenceEnrollment.findMany({
      where: { contactId, status: SequenceEnrollmentStatus.ACTIVE },
      select: { id: true },
    });
    for (const row of list) {
      await this.scheduler.removeAllKnownJobsForEnrollment(row.id);
      await this.prisma.sequenceEnrollment.update({
        where: { id: row.id },
        data: {
          status: SequenceEnrollmentStatus.CANCELLED,
          pendingJobId: null,
          nextRunAt: null,
        },
      });
    }
    if (list.length) {
      this.logger.log(`Cancelled ${list.length} sequence enrollment(s) for contact ${contactId}`);
    }
  }

  /** Archive / admin: cancel active enrollments for a sequence. */
  async cancelActiveEnrollmentsForSequence(sequenceId: string): Promise<number> {
    const list = await this.prisma.sequenceEnrollment.findMany({
      where: { sequenceId, status: SequenceEnrollmentStatus.ACTIVE },
      select: { id: true },
    });
    for (const row of list) {
      await this.scheduler.removeAllKnownJobsForEnrollment(row.id);
      await this.prisma.sequenceEnrollment.update({
        where: { id: row.id },
        data: {
          status: SequenceEnrollmentStatus.CANCELLED,
          pendingJobId: null,
          nextRunAt: null,
        },
      });
    }
    return list.length;
  }
}
