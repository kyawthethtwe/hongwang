import { BOOKING_TIMEOUT_JOBS, QUEUES, type BookingTimeoutJob } from '@hongwang/shared';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { BookingLifecycleService } from './booking-lifecycle.service';

export const SWEEP_EVERY_MS = 60_000;

/** Consumer for QUEUES.bookingTimeouts: delayed expire/complete jobs and the sweep. */
@Processor(QUEUES.bookingTimeouts, { concurrency: 5 })
export class BookingTimeoutsProcessor extends WorkerHost {
  constructor(private readonly lifecycle: BookingLifecycleService) {
    super();
  }

  async process(job: Job<Partial<BookingTimeoutJob>>): Promise<unknown> {
    const id = job.data.bookingId;
    switch (job.name) {
      case BOOKING_TIMEOUT_JOBS.expireHold:
        return id ? this.lifecycle.expireHold(id) : false;
      case BOOKING_TIMEOUT_JOBS.expireRequest:
        return id ? this.lifecycle.expireRequest(id) : false;
      case BOOKING_TIMEOUT_JOBS.completeStay:
        return id ? this.lifecycle.completeStay(id) : false;
      case BOOKING_TIMEOUT_JOBS.sweep:
        return this.lifecycle.sweep();
      default:
        return false;
    }
  }
}

/** Registers the once-a-minute sweep (BullMQ 5 job scheduler; upsert is idempotent across restarts). */
@Injectable()
export class BookingSweepScheduler implements OnModuleInit {
  private readonly logger = new Logger(BookingSweepScheduler.name);

  constructor(@InjectQueue(QUEUES.bookingTimeouts) private readonly queue: Queue) {}

  async onModuleInit() {
    await this.queue.upsertJobScheduler(
      BOOKING_TIMEOUT_JOBS.sweep,
      { every: SWEEP_EVERY_MS },
      {
        name: BOOKING_TIMEOUT_JOBS.sweep,
        data: {},
        opts: { attempts: 1, removeOnComplete: 100, removeOnFail: 500 },
      },
    );
    this.logger.log(`Booking sweep scheduled every ${SWEEP_EVERY_MS / 1000}s`);
  }
}
