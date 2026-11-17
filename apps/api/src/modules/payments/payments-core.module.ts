import { Module } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { StripeService } from './stripe.service';

/**
 * Owner: Bookings & Payments module. Stripe client + refunds, with no dependency on the bookings
 * module, so BookingsModule, PaymentsModule and the worker can all import it without cycles.
 */
@Module({
  providers: [StripeService, RefundsService],
  exports: [StripeService, RefundsService],
})
export class PaymentsCoreModule {}
