import { Module } from '@nestjs/common';
import { PaymentsCoreModule } from '../payments/payments-core.module';
import { BookingsController } from './bookings.controller';
import { BookingsCoreModule } from './bookings-core.module';
import { BookingsService } from './bookings.service';

/**
 * Owner: Bookings & Payments module.
 * Booking state machine (requested -> payment_hold -> confirmed -> completed, plus
 * rejected/expired/cancelled), quote, create (request or instant book), approve/reject, cancel.
 * Exports BookingReadService (via BookingsCoreModule) for the Host module, and BookingsService.
 */
@Module({
  imports: [BookingsCoreModule, PaymentsCoreModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsCoreModule, BookingsService],
})
export class BookingsModule {}
