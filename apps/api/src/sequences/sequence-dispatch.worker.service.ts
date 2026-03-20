import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { getBullmqConnectionConfig } from '../campaign-send/bullmq-redis';
import { SEQUENCE_DISPATCH_QUEUE_NAME } from './sequence-dispatch.constants';
import { SequenceSendExecutor } from './sequence-send.executor';

@Injectable()
export class SequenceDispatchWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SequenceDispatchWorkerService.name);
  private worker?: Worker;

  constructor(
    private readonly executor: SequenceSendExecutor,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      SEQUENCE_DISPATCH_QUEUE_NAME,
      async (job) => {
        await this.executor.processJob(job);
      },
      {
        connection: getBullmqConnectionConfig(),
        concurrency: Math.max(1, Number(this.config.get('SEQUENCE_WORKER_CONCURRENCY') ?? 3)),
        limiter: {
          max: Math.max(1, Number(this.config.get('SEQUENCE_WORKER_GLOBAL_JOBS_PER_SEC') ?? 30)),
          duration: 1000,
        },
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`sequence job ${job.id} (${job.name}) completed`);
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error(`sequence job ${job?.id} failed: ${err?.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
