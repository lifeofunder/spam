import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { CampaignScheduleTriggerService } from './campaign-schedule-trigger.service';
import { getBullmqConnectionConfig } from './bullmq-redis';
import {
  CAMPAIGN_SCHEDULED_START_JOB_NAME,
  CAMPAIGN_SEND_QUEUE_NAME,
} from './campaign-send.constants';
import { CampaignSendExecutor } from './campaign-send.executor';

@Injectable()
export class CampaignSendWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignSendWorkerService.name);
  private worker?: Worker;

  constructor(
    private readonly executor: CampaignSendExecutor,
    private readonly scheduleTrigger: CampaignScheduleTriggerService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      CAMPAIGN_SEND_QUEUE_NAME,
      async (job) => {
        if (job.name === CAMPAIGN_SCHEDULED_START_JOB_NAME) {
          await this.scheduleTrigger.process(job);
          return;
        }
        try {
          await this.executor.processJob(job);
        } catch (err) {
          const campaignId = job.data?.campaignId;
          if (campaignId) {
            await this.executor.markCampaignFailed(campaignId);
          }
          throw err;
        }
      },
      {
        connection: getBullmqConnectionConfig(),
        concurrency: Math.max(1, Number(this.config.get('CAMPAIGN_WORKER_CONCURRENCY') ?? 2)),
        limiter: {
          max: Math.max(1, Number(this.config.get('CAMPAIGN_WORKER_GLOBAL_JOBS_PER_SEC') ?? 20)),
          duration: 1000,
        },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`campaign-send job ${job.id} completed`);
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`campaign-send job ${job?.id} failed: ${err?.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
