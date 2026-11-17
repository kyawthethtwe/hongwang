import { BOOKING_TIMEOUT_JOBS, QUEUES, type BookingTimeoutJob, type IsoDate } from '@hongwang/shared';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { stayCompletesAt } from './booking-format';

/** Fire a little after the deadline so the conditional update's `<= now` guard always matches. */
const SLACK_MS = 2_000;

type TimeoutJobName = (typeof BOOKING_TIMEOUT_JOBS)[Exclude<keyof typeof BOOKING_TIMEOUT_JOBS, 'sweep'>];

/** BullMQ custom ids may not contain ':' (unless they have exactly three parts), so use '-'. */
export const timeoutJobId = (name: TimeoutJobName, bookingId: string) => `${name}-${bookingId}`;

/**
 * Owner: Bookings & Payments module. Producer for QUEUES.bookingTimeouts: one delayed job per
 * deadline (hold expiry, request expiry, stay completion), deduplicated by job id. Enqueue failures
 * are logged, not thrown: the once-a-minute sweep in the worker catches anything missed.
 */
@Injectable()
export class BookingTimeouts {
  private readonly logger = new Logger(BookingTimeouts.name);

  constructor(@InjectQueue(QUEUES.bookingTimeouts) private readonly queue: Queue<BookingTimeoutJob>) {}

  expireHoldAt(bookingId: string, at: Date) {
    return this.add(BOOKING_TIMEOUT_JOBS.expireHold, bookingId, at);
  }

  expireRequestAt(bookingId: string, at: Date) {
    return this.add(BOOKING_TIMEOUT_JOBS.expireRequest, bookingId, at);
  }

  completeAfter(bookingId: string, checkOut: IsoDate) {
    return this.add(BOOKING_TIMEOUT_JOBS.completeStay, bookingId, stayCompletesAt(checkOut));
  }

  private async add(name: TimeoutJobName, bookingId: string, at: Date) {
    try {
      await this.queue.add(
        name,
        { bookingId },
        { jobId: timeoutJobId(name, bookingId), delay: Math.max(0, at.getTime() - Date.now()) + SLACK_MS },
      );
    } catch (err) {
      this.logger.warn({ err, bookingId, name }, 'Could not schedule booking timeout; the sweep will catch it');
    }
  }
}
