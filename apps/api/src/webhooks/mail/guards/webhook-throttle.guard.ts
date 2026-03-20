import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/** Simple per-IP sliding window (in-memory; scale-out needs Redis-backed limiter). */
@Injectable()
export class WebhookThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const windowMs = 60_000;
    const max = Math.max(
      1,
      Number(this.config.get<string>('WEBHOOK_MAIL_MAX_PER_MINUTE_IP') ?? 120),
    );
    const req = context.switchToHttp().getRequest<Request>();
    const ip = String(req.ip ?? req.socket?.remoteAddress ?? 'unknown');
    const now = Date.now();
    const windowStart = now - windowMs;
    let arr = this.hits.get(ip) ?? [];
    arr = arr.filter((t) => t > windowStart);
    if (arr.length >= max) {
      throw new HttpException('Too many webhook requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    arr.push(now);
    this.hits.set(ip, arr);
    return true;
  }
}
