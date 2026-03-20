import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeClientService implements OnModuleInit {
  private readonly logger = new Logger(StripeClientService.name);
  private stripe: Stripe | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const key = this.config.get<string>('STRIPE_SECRET_KEY')?.trim();
    if (!key) {
      this.logger.warn('STRIPE_SECRET_KEY is not set — billing endpoints will fail until configured');
      return;
    }
    this.stripe = new Stripe(key, { typescript: true });
  }

  get client(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured (missing STRIPE_SECRET_KEY)');
    }
    return this.stripe;
  }

  isConfigured(): boolean {
    return this.stripe != null;
  }
}
