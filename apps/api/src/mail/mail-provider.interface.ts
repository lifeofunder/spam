import type { SendMailPayload, SendMailResult } from './mail.types';

export interface MailProvider {
  send(payload: SendMailPayload): Promise<SendMailResult>;
}
