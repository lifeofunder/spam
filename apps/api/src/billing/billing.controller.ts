import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BillingSummaryService } from './billing-summary.service';
import { StripeCheckoutService } from './stripe-checkout.service';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly summary: BillingSummaryService,
    private readonly checkout: StripeCheckoutService,
  ) {}

  @Get()
  getSummary(@CurrentUser('workspaceId') workspaceId: string) {
    return this.summary.getSummary(workspaceId);
  }

  @Post('checkout-session')
  createCheckout(
    @CurrentUser('workspaceId') workspaceId: string,
    @CurrentUser('email') email: string,
  ) {
    return this.checkout.createProCheckoutSession(workspaceId, email);
  }

  @Post('portal-session')
  createPortal(@CurrentUser('workspaceId') workspaceId: string) {
    return this.checkout.createBillingPortalSession(workspaceId);
  }
}
