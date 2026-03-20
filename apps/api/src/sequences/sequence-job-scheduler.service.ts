import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  SEQUENCE_ADVANCE_JOB_NAME,
  SEQUENCE_DISPATCH_QUEUE_TOKEN,
  SEQUENCE_STEP_SEND_JOB_NAME,
  sequenceAdvanceJobId,
  sequenceStepJobId,
} from './sequence-dispatch.constants';
import type { SequenceAdvancePayload, SequenceStepSendPayload } from './sequence-dispatch.types';

@Injectable()
export class SequenceJobSchedulerService {
  private readonly logger = new Logger(SequenceJobSchedulerService.name);

  constructor(
    @Inject(SEQUENCE_DISPATCH_QUEUE_TOKEN)
    private readonly queue: Queue<SequenceStepSendPayload | SequenceAdvancePayload>,
  ) {}

  async removeJobById(jobId: string): Promise<void> {
    try {
      const j = await this.queue.getJob(jobId);
      if (j) {
        await j.remove();
      }
    } catch (err) {
      this.logger.warn(`removeJobById ${jobId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Best-effort: remove known idempotent keys for an enrollment. */
  async removeAllKnownJobsForEnrollment(enrollmentId: string, maxOrder = 32): Promise<void> {
    for (let o = 0; o <= maxOrder; o++) {
      await this.removeJobById(sequenceStepJobId(enrollmentId, o));
      await this.removeJobById(sequenceAdvanceJobId(enrollmentId, o));
    }
  }

  async scheduleStepSend(
    payload: SequenceStepSendPayload,
    delayMs: number,
  ): Promise<string> {
    const jobId = sequenceStepJobId(payload.enrollmentId, payload.stepOrder);
    await this.removeJobById(jobId);
    const job = await this.queue.add(SEQUENCE_STEP_SEND_JOB_NAME, payload, {
      jobId,
      delay: Math.max(0, delayMs),
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 86_400 },
    });
    return String(job.id ?? jobId);
  }

  async scheduleAdvance(payload: SequenceAdvancePayload, delayMs: number): Promise<string> {
    const jobId = sequenceAdvanceJobId(payload.enrollmentId, payload.nextStepOrder);
    await this.removeJobById(jobId);
    const job = await this.queue.add(SEQUENCE_ADVANCE_JOB_NAME, payload, {
      jobId,
      delay: Math.max(0, delayMs),
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 86_400 },
    });
    return String(job.id ?? jobId);
  }
}
