import { Module } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../prisma.module';
import { CampaignDispatchEnqueueService } from './campaign-dispatch-enqueue.service';
import { createCampaignSendQueue } from './bullmq-redis';
import { CAMPAIGN_SEND_QUEUE_TOKEN } from './campaign-send.constants';
import type { CampaignSendJobPayload } from './campaign-send.types';

@Module({
  imports: [PrismaModule, BillingModule],
  providers: [
    {
      provide: CAMPAIGN_SEND_QUEUE_TOKEN,
      useFactory: (): Queue<CampaignSendJobPayload> =>
        createCampaignSendQueue() as Queue<CampaignSendJobPayload>,
    },
    CampaignDispatchEnqueueService,
  ],
  exports: [CAMPAIGN_SEND_QUEUE_TOKEN, CampaignDispatchEnqueueService],
})
export class CampaignSendQueueModule {}
