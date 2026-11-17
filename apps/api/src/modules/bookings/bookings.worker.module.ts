import { Module } from '@nestjs/common';
import { PaymentsCoreModule } from '../payments/payments-core.module';
import { BookingLifecycleService } from './booking-lifecycle.service';
import { BookingSweepScheduler, BookingTimeoutsProcessor } from './booking-timeouts.processor';
import { BookingsCoreModule } from './bookings-core.module';

/**
 * Owner: Bookings & Payments module.
 * Consumers for QUEUES.bookingTimeouts (expire holds and requests, complete stays, sweep).
 * Imported only by src/worker.module.ts.
 */
@Module({
  imports: [BookingsCoreModule, PaymentsCoreModule],
  providers: [BookingLifecycleService, BookingTimeoutsProcessor, BookingSweepScheduler],
})
export class BookingsWorkerModule {}
