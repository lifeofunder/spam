import { NestFactory } from '@nestjs/core';
import { CampaignWorkerModule } from './campaign-send/campaign-worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(CampaignWorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();
  // CampaignSendWorkerService starts the BullMQ worker in onModuleInit.
}

void bootstrap();
