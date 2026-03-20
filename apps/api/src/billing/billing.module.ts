import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { BillingController } from './billing.controller';
import { BillingSummaryService } from './billing-summary.service';
import { EntitlementsService } from './entitlements.service';
import { StripeCheckoutService } from './stripe-checkout.service';
import { StripeClientService } from './stripe-client.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { UsageService } from './usage.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [
    StripeClientService,
    StripeCheckoutService,
    StripeWebhookService,
    UsageService,
    EntitlementsService,
    BillingSummaryService,
  ],
  exports: [UsageService, EntitlementsService, BillingSummaryService, StripeClientService],
})
export class BillingModule {}
