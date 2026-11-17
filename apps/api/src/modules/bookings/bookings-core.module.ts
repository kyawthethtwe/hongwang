import { Module } from '@nestjs/common';
import { BookingEmails } from './booking-emails.service';
import { BookingReadService } from './booking-read.service';
import { BookingTimeouts } from './booking-timeouts.service';

/**
 * Owner: Bookings & Payments module. What the HTTP modules (bookings, payments, host) and the worker
 * share: the BookingDto read model, booking emails and the timeout-job producer.
 * (Status changes themselves go through `applyTransition` in booking-transitions.ts.)
 */
@Module({
  providers: [BookingReadService, BookingEmails, BookingTimeouts],
  exports: [BookingReadService, BookingEmails, BookingTimeouts],
})
export class BookingsCoreModule {}
