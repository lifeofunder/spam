import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MailWebhookVerifier, MailWebhookVerifierContext } from './mail-webhook-verifier.interface';

/**
 * Placeholder for SendGrid signed Event Webhook (ECDSA over raw body).
 * MVP: rely on shared `X-Webhook-Secret` via {@link WebhookMailSecretGuard}.
 * When `SENDGRID_WEBHOOK_PUBLIC_KEY` is set, you can extend `verify()` with
 * `@sendgrid/eventwebhook` or manual ECDSA verification (see SendGrid docs).
 */
@Injectable()
export class SendGridWebhookVerifier implements MailWebhookVerifier {
  private readonly logger = new Logger(SendGridWebhookVerifier.name);

  constructor(private readonly config: ConfigService) {}

  async verify(ctx: MailWebhookVerifierContext): Promise<boolean> {
    void ctx;
    const pk = this.config.get<string>('SENDGRID_WEBHOOK_PUBLIC_KEY');
    if (!pk?.trim()) {
      return true;
    }
    this.logger.warn(
      'SENDGRID_WEBHOOK_PUBLIC_KEY is set but ECDSA verification is not implemented yet; use X-Webhook-Secret or implement verify()',
    );
    return true;
  }
}
