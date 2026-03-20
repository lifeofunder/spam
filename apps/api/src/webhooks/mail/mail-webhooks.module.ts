import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { SequencesModule } from '../../sequences/sequences.module';
import { WebhookMailSecretGuard } from './guards/webhook-mail-secret.guard';
import { WebhookThrottleGuard } from './guards/webhook-throttle.guard';
import { MailWebhooksController } from './mail-webhooks.controller';
import { MailWebhooksService } from './mail-webhooks.service';

@Module({
  imports: [PrismaModule, SequencesModule],
  controllers: [MailWebhooksController],
  providers: [MailWebhooksService, WebhookMailSecretGuard, WebhookThrottleGuard],
})
export class MailWebhooksModule {}
