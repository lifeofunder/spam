import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BillingModule } from '../billing/billing.module';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma.module';
import { CampaignScheduleTriggerService } from './campaign-schedule-trigger.service';
import { CampaignSendExecutor } from './campaign-send.executor';
import { CampaignSendQueueModule } from './campaign-send.queue.module';
import { CampaignSendWorkerService } from './campaign-send.worker.service';
import { SequenceDispatchQueueModule } from '../sequences/sequence-dispatch.queue.module';
import { SequenceDispatchWorkerService } from '../sequences/sequence-dispatch.worker.service';
import { SequenceSendExecutor } from '../sequences/sequence-send.executor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    BillingModule,
    MailModule,
    CampaignSendQueueModule,
    SequenceDispatchQueueModule,
  ],
  providers: [
    CampaignSendExecutor,
    CampaignScheduleTriggerService,
    CampaignSendWorkerService,
    SequenceSendExecutor,
    SequenceDispatchWorkerService,
  ],
})
export class CampaignWorkerModule {}
