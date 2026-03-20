import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MailWebhooksService } from './mail-webhooks.service';
import { normalizeGenericMailWebhook } from './normalize/generic-mail-webhook.normalize';
import { normalizeSendGridMailEvent } from './normalize/sendgrid-mail-webhook.normalize';
import { WebhookMailSecretGuard } from './guards/webhook-mail-secret.guard';
import { WebhookThrottleGuard } from './guards/webhook-throttle.guard';

@Controller('webhooks/mail')
@UseGuards(WebhookThrottleGuard, WebhookMailSecretGuard)
export class MailWebhooksController {
  constructor(private readonly mailWebhooks: MailWebhooksService) {}

  @Post('generic')
  async generic(@Body() body: unknown) {
    const n = normalizeGenericMailWebhook(body);
    if (!n) {
      throw new BadRequestException('Invalid generic webhook payload');
    }
    return this.mailWebhooks.ingest('generic', n, body);
  }

  /**
   * Accepts SendGrid Event Webhook JSON array or a single event object.
   * Unsupported event types (open, click, …) are skipped.
   */
  @Post('sendgrid')
  async sendgrid(@Body() body: unknown) {
    const list = Array.isArray(body) ? body : [body];
    const results: Array<{ ok: boolean; duplicate?: boolean; skipped?: boolean }> = [];
    for (const item of list) {
      const n = normalizeSendGridMailEvent(item);
      if (!n) {
        results.push({ ok: true, skipped: true });
        continue;
      }
      results.push(await this.mailWebhooks.ingest('sendgrid', n, item));
    }
    return { results };
  }
}
