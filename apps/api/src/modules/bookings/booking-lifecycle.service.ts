import { todayInBangkok } from '@hongwang/shared';
import { Injectable, Logger } from '@nestjs/common';
import { and, eq, lt, lte } from 'drizzle-orm';
import { InjectDb, type Database } from '../../database/database.module';
import { bookings } from '../../database/schema';
import { RefundsService } from '../payments/refunds.service';
import { BookingEmails } from './booking-emails.service';
import { applyTransition } from './booking-transitions';

const SWEEP_BATCH = 500;

export interface SweepResult {
  holdsExpired: number;
  requestsExpired: number;
  staysCompleted: number;
}

/**
 * Owner: Bookings & Payments module. The system's timeouts (worker side). Every method is
 * idempotent: it is a conditional update guarded by the deadline, so a delayed job, a retry and
 * the sweep can all run for the same booking and only the first does anything.
 */
@Injectable()
export class BookingLifecycleService {
  private readonly logger = new Logger(BookingLifecycleService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly emails: BookingEmails,
    private readonly refunds: RefundsService,
  ) {}

  /** payment_hold -> expired once hold_expires_at has passed. */
  async expireHold(bookingId: string, now = new Date()): Promise<boolean> {
    const row = await applyTransition(this.db, {
      booking: { id: bookingId, status: 'payment_hold' },
      transition: 'expire',
      actor: 'system',
      set: { expiredAt: now },
      where: lte(bookings.holdExpiresAt, now),
      note: 'Payment hold ran out',
    });
    if (!row) return false;
    await this.refunds.cancelPending(bookingId);
    await this.emails.expired(bookingId, 'hold');
    return true;
  }

  /** requested -> expired once request_expires_at has passed (the host didn't answer). */
  async expireRequest(bookingId: string, now = new Date()): Promise<boolean> {
    const row = await applyTransition(this.db, {
      booking: { id: bookingId, status: 'requested' },
      transition: 'expire',
      actor: 'system',
      set: { expiredAt: now },
      where: lte(bookings.requestExpiresAt, now),
      note: 'Host didn’t answer in time',
    });
    if (!row) return false;
    await this.emails.expired(bookingId, 'request');
    return true;
  }

  /** confirmed -> completed once check_out < today (Bangkok). */
  async completeStay(bookingId: string, now = new Date()): Promise<boolean> {
    const row = await applyTransition(this.db, {
      booking: { id: bookingId, status: 'confirmed' },
      transition: 'complete',
      actor: 'system',
      set: { completedAt: now },
      where: lt(bookings.checkOut, todayInBangkok(now)),
    });
    return !!row;
  }

  /** Safety net for missed delayed jobs (Redis restarts, enqueue failures). Runs every minute. */
  async sweep(now = new Date()): Promise<SweepResult> {
    const ids = async (where: ReturnType<typeof and>) =>
      (await this.db.select({ id: bookings.id }).from(bookings).where(where).limit(SWEEP_BATCH)).map((r) => r.id);

    const holds = await ids(and(eq(bookings.status, 'payment_hold'), lte(bookings.holdExpiresAt, now)));
    const requests = await ids(and(eq(bookings.status, 'requested'), lte(bookings.requestExpiresAt, now)));
    const stays = await ids(and(eq(bookings.status, 'confirmed'), lt(bookings.checkOut, todayInBangkok(now))));

    const result: SweepResult = { holdsExpired: 0, requestsExpired: 0, staysCompleted: 0 };
    for (const id of holds) if (await this.safely(id, () => this.expireHold(id, now))) result.holdsExpired++;
    for (const id of requests) if (await this.safely(id, () => this.expireRequest(id, now))) result.requestsExpired++;
    for (const id of stays) if (await this.safely(id, () => this.completeStay(id, now))) result.staysCompleted++;
    if (result.holdsExpired || result.requestsExpired || result.staysCompleted) {
      this.logger.log(result, 'Booking sweep');
    }
    return result;
  }

  private async safely(bookingId: string, fn: () => Promise<boolean>) {
    try {
      return await fn();
    } catch (err) {
      this.logger.error({ err, bookingId }, 'Booking sweep step failed');
      return false;
    }
  }
}
