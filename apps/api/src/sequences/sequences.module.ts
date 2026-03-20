import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { SequenceDispatchQueueModule } from './sequence-dispatch.queue.module';
import { SequenceLifecycleService } from './sequence-lifecycle.service';
import { SequencesController } from './sequences.controller';
import { SequencesService } from './sequences.service';

@Module({
  imports: [AuthModule, BillingModule, SequenceDispatchQueueModule],
  controllers: [SequencesController],
  providers: [SequenceLifecycleService, SequencesService],
  exports: [SequenceLifecycleService, SequenceDispatchQueueModule],
})
export class SequencesModule {}
