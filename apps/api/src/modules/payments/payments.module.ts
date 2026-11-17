import { Module } from '@nestjs/common';
import { BookingsCoreModule } from '../bookings/bookings-core.module';
import { PaymentsController } from './payments.controller';
import { PaymentsCoreModule } from './payments-core.module';
import { PaymentsService } from './payments.service';

/**
 * Owner: Bookings & Payments module.
 * Stripe PaymentIntents (test mode), webhook confirmation, refunds, dev simulate endpoint.
 */
@Module({
  imports: [PaymentsCoreModule, BookingsCoreModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
