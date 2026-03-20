import { Logger } from '@nestjs/common';
import type { MailProvider } from './mail-provider.interface';
import type { SendMailPayload, SendMailResult } from './mail.types';

export class DevMailProvider implements MailProvider {
  private readonly logger = new Logger(DevMailProvider.name);

  async send(payload: SendMailPayload): Promise<SendMailResult> {
    this.logger.log(
      `[DEV MAIL] to=${payload.to} subject=${JSON.stringify(payload.subject)} htmlBytes=${payload.html.length}`,
    );
    this.logger.debug(
      JSON.stringify(
        {
          to: payload.to,
          subject: payload.subject,
          text: payload.text,
          htmlPreview: payload.html.slice(0, 500),
        },
        null,
        2,
      ),
    );
    return {};
  }
}
