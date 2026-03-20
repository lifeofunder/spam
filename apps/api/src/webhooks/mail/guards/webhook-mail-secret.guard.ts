import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Compares `X-Webhook-Secret` header to `WEBHOOK_MAIL_SECRET` (never logged).
 */
@Injectable()
export class WebhookMailSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('WEBHOOK_MAIL_SECRET');
    if (!expected?.trim()) {
      throw new ServiceUnavailableException('Mail webhooks are not configured');
    }
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['x-webhook-secret'];
    const got = typeof header === 'string' ? header : Array.isArray(header) ? header[0] ?? '' : '';
    if (!this.constantTimeEqual(got, expected)) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
    return true;
  }

  private constantTimeEqual(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a, 'utf8');
      const bufB = Buffer.from(b, 'utf8');
      if (bufA.length !== bufB.length) {
        return false;
      }
      return timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }
}
