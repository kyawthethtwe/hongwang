import type { BookingDto, PaymentIntentDto } from '@hongwang/shared';
import { Body, Controller, Headers, HttpCode, Param, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, Public, type AuthUser } from '../../common/auth';
import { BookingIdParamDto, CreatePaymentIntentBody } from './payments.dto';
import { PaymentsService } from './payments.service';

/** Owner: Bookings & Payments module. Routes: packages/shared/src/schemas/payments.ts. */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('intent')
  @HttpCode(200)
  createIntent(@CurrentUser() user: AuthUser, @Body() body: CreatePaymentIntentBody): Promise<PaymentIntentDto> {
    return this.payments.createIntent(user, body);
  }

  /** Stripe calls this; the signature is checked over req.rawBody (main.ts sets rawBody: true). */
  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    return this.payments.handleWebhook(req.rawBody, signature);
  }

  /** Dev only (no STRIPE_SECRET_KEY, NODE_ENV !== 'production'): pays through the webhook's code path. */
  @Post(':bookingId/simulate')
  @HttpCode(200)
  simulate(@CurrentUser() user: AuthUser, @Param() params: BookingIdParamDto): Promise<BookingDto> {
    return this.payments.simulate(user, params.bookingId);
  }
}
