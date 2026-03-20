import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { MailProvider } from './mail-provider.interface';
import type { SendMailPayload, SendMailResult } from './mail.types';
import { normalizeMessageIdForStorage } from './message-id.util';

/**
 * SMTP / API-ready transport (Nodemailer). Use with MailHog: SMTP_HOST=localhost SMTP_PORT=1025 (no TLS).
 * If SMTP_HOST is missing, falls back to logging only (stub).
 */
@Injectable()
export class SmtpMailProvider implements MailProvider {
  private readonly logger = new Logger(SmtpMailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(payload: SendMailPayload): Promise<SendMailResult> {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';
    const from = this.config.get<string>('MAIL_FROM') ?? 'noreply@localhost';

    if (!host) {
      this.logger.warn('SMTP_HOST not set — stub mode (log only). Configure SMTP for real delivery.');
      this.logger.log(
        `[SMTP STUB] to=${payload.to} subject=${JSON.stringify(payload.subject)}`,
      );
      return {};
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });

    const info = await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    const rawMid = typeof info.messageId === 'string' ? info.messageId : undefined;
    const smtpMessageId = normalizeMessageIdForStorage(rawMid);
    return {
      smtpMessageId,
      providerMessageId: smtpMessageId,
    };
  }
}
