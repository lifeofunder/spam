/**
 * Optional provider-specific authenticity check (signature, ECDSA, etc.).
 * Generic MVP uses {@link WebhookMailSecretGuard} + header `X-Webhook-Secret` only.
 */
export interface MailWebhookVerifierContext {
  headers: Record<string, string | string[] | undefined>;
  /** Raw request body bytes when available (for HMAC/signature verification). */
  rawBody: Buffer;
}

export interface MailWebhookVerifier {
  verify(ctx: MailWebhookVerifierContext): Promise<boolean>;
}
