import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

type RawBodyRequest = Request & { rawBody?: Buffer };
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('webhooks')
export class StripeWebhookController {
  constructor(private readonly webhooks: StripeWebhookService) {}

  @Post('stripe')
  @HttpCode(200)
  async handleStripe(
    @Req() req: RawBodyRequest,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    const raw = req.rawBody;
    if (!raw || !Buffer.isBuffer(raw)) {
      throw new BadRequestException('Missing raw body');
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    const event = this.webhooks.verifyAndParse(raw, signature);
    await this.webhooks.processEvent(event);
    return { received: true };
  }
}
