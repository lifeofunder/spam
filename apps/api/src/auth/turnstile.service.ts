import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Optional Cloudflare Turnstile verification.
 * When `TURNSTILE_SECRET_KEY` is unset, verification is skipped (development).
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * If Turnstile is configured, requires a valid `token` from the client widget.
   * Otherwise no-op.
   */
  async verifyOptionalOrThrow(token: string | undefined, remoteIp: string | undefined): Promise<void> {
    const secret = this.config.get<string>('TURNSTILE_SECRET_KEY')?.trim();
    if (!secret) {
      return;
    }
    if (!token?.trim()) {
      throw new BadRequestException('Captcha verification required');
    }
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token.trim());
    if (remoteIp) {
      body.set('remoteip', remoteIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      this.logger.warn(`Turnstile HTTP ${res.status}`);
      throw new BadRequestException('Captcha verification failed');
    }

    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      this.logger.warn(`Turnstile rejected: ${JSON.stringify(data['error-codes'] ?? [])}`);
      throw new BadRequestException('Captcha verification failed');
    }
  }
}
