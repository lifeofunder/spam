import { Module } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { createSequenceDispatchQueue } from '../campaign-send/bullmq-redis';
import { SEQUENCE_DISPATCH_QUEUE_TOKEN } from './sequence-dispatch.constants';
import type { SequenceAdvancePayload } from './sequence-dispatch.types';
import type { SequenceStepSendPayload } from './sequence-dispatch.types';
import { SequenceJobSchedulerService } from './sequence-job-scheduler.service';

@Module({
  providers: [
    {
      provide: SEQUENCE_DISPATCH_QUEUE_TOKEN,
      useFactory: (): Queue<SequenceStepSendPayload | SequenceAdvancePayload> =>
        createSequenceDispatchQueue() as Queue<SequenceStepSendPayload | SequenceAdvancePayload>,
    },
    SequenceJobSchedulerService,
  ],
  exports: [SEQUENCE_DISPATCH_QUEUE_TOKEN, SequenceJobSchedulerService],
})
export class SequenceDispatchQueueModule {}
