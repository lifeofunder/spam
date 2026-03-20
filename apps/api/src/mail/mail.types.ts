export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

export interface SendMailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Returned after SMTP send; used for webhook correlation. */
export interface SendMailResult {
  /** RFC 5322 Message-ID (normalized before DB write). */
  smtpMessageId?: string;
  /** Provider-specific id when available (often same as SMTP id for simple SMTP). */
  providerMessageId?: string;
}
