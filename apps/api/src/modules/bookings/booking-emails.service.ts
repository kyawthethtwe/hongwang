import { formatTHB, type BookingActor, type BookingEmailBase, type EmailJob, type EmailTemplate } from '@hongwang/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { ENV, type Env } from '../../config/env';
import { InjectDb, type Database } from '../../database/database.module';
import { bookings } from '../../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { formatBangkokDateTime, formatEmailDay } from './booking-format';

type Party = { id: string; firstName: string; email: string | null };

/**
 * Owner: Bookings & Payments module. Builds the `data` of every booking email (EmailTemplateData
 * in @hongwang/shared) and queues it through NotificationsService. Runs after the transaction
 * commits and never throws: a failed email must not undo a booking.
 */
@Injectable()
export class BookingEmails {
  private readonly logger = new Logger(BookingEmails.name);

  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Request to book: host gets the request, guest gets "request sent". Job ids are fixed per booking,
   * so a replayed POST /bookings (Idempotency-Key) doesn't send them twice.
   */
  requested(bookingId: string) {
    return this.run(bookingId, async (c) => {
      const respondBy = c.b.requestExpiresAt ? formatBangkokDateTime(c.b.requestExpiresAt) : '';
      await this.send(
        'booking-requested-host',
        c.host,
        {
          ...c.base(c.host, c.guest),
          message: c.b.message,
          payout: formatTHB(c.b.hostPayout),
          respondBy,
          reservationUrl: this.url(`/host/reservations/${c.b.id}`),
        },
        `booking-requested-host-${c.b.id}`,
      );
      await this.send(
        'booking-request-sent-guest',
        c.guest,
        {
          ...c.base(c.guest, c.host),
          total: formatTHB(c.b.total),
          respondBy,
          tripUrl: this.url(`/trips/${c.b.id}`),
        },
        `booking-request-sent-guest-${c.b.id}`,
      );
    });
  }

  approved(bookingId: string) {
    return this.run(bookingId, (c) =>
      this.send('booking-approved-guest', c.guest, {
        ...c.base(c.guest, c.host),
        total: formatTHB(c.b.total),
        payBy: c.b.holdExpiresAt ? formatBangkokDateTime(c.b.holdExpiresAt) : '',
        checkoutUrl: this.url(`/checkout/${c.b.id}`),
      }),
    );
  }

  rejected(bookingId: string) {
    return this.run(bookingId, (c) =>
      this.send('booking-rejected-guest', c.guest, { ...c.base(c.guest, c.host), searchUrl: this.url('/') }),
    );
  }

  expired(bookingId: string, reason: 'request' | 'hold') {
    return this.run(bookingId, (c) =>
      this.send('booking-expired-guest', c.guest, {
        ...c.base(c.guest, c.host),
        reason,
        listingUrl: this.url(`/rooms/${c.b.listingId}?checkIn=${c.b.checkIn}&checkOut=${c.b.checkOut}&guests=${c.b.guests}`),
      }),
    );
  }

  confirmed(bookingId: string) {
    return this.run(bookingId, async (c) => {
      const l = c.listing;
      await this.send('booking-confirmed-guest', c.guest, {
        ...c.base(c.guest, c.host),
        total: formatTHB(c.b.total),
        address: [l.addressLine, l.subdistrict, l.district, l.province, l.postcode].filter(Boolean).join(', '),
        checkInFrom: l.checkInFrom,
        checkOutBy: l.checkOutBy,
        tripUrl: this.url(`/trips/${c.b.id}`),
      });
      await this.send('booking-confirmed-host', c.host, {
        ...c.base(c.host, c.guest),
        payout: formatTHB(c.b.hostPayout),
        reservationUrl: this.url(`/host/reservations/${c.b.id}`),
      });
    });
  }

  cancelled(bookingId: string) {
    return this.run(bookingId, async (c) => {
      const cancelledBy: BookingActor = c.b.cancelledBy ?? 'system';
      await this.send('booking-cancelled-guest', c.guest, {
        ...c.base(c.guest, c.host),
        cancelledBy,
        refund: formatTHB(c.b.refundAmount ?? 0),
        tripUrl: this.url(`/trips/${c.b.id}`),
      });
      await this.send('booking-cancelled-host', c.host, {
        ...c.base(c.host, c.guest),
        cancelledBy,
        penalty: c.b.hostPenalty ? formatTHB(c.b.hostPenalty) : null,
        reservationUrl: this.url(`/host/reservations/${c.b.id}`),
      });
    });
  }

  private url(path: string) {
    return new URL(path, this.env.WEB_ORIGIN).toString();
  }

  /** `jobId` makes the email once-only: BullMQ ignores a second job with the same id. No ':' allowed. */
  private async send<T extends EmailTemplate>(template: T, to: Party, data: EmailJob<T>['data'], jobId?: string) {
    if (!to.email) return; // phone-only account: nothing to send to
    const job = { template, to: to.email, data, userId: to.id };
    await (jobId ? this.notifications.sendEmail(job, { jobId }) : this.notifications.sendEmail(job));
  }

  private async run(bookingId: string, fn: (c: EmailContext) => Promise<void>): Promise<void> {
    try {
      const b = await loadBooking(this.db, bookingId);
      if (!b) return;
      const guest: Party = { id: b.guest.id, firstName: b.guest.firstName, email: b.guest.email };
      const host: Party = { id: b.host.id, firstName: b.host.firstName, email: b.host.email };
      await fn({
        b,
        listing: b.listing,
        guest,
        host,
        base: (me, other): BookingEmailBase => ({
          firstName: me.firstName,
          otherName: other.firstName,
          listingTitle: b.listing.title,
          ref: b.ref,
          checkIn: formatEmailDay(b.checkIn),
          checkOut: formatEmailDay(b.checkOut),
          nights: b.nights,
          guests: b.guests,
        }),
      });
    } catch (err) {
      this.logger.error({ err, bookingId }, 'Could not queue booking email');
    }
  }
}

function loadBooking(db: Database, id: string) {
  return db.query.bookings.findFirst({
    where: eq(bookings.id, id),
    with: { listing: true, guest: true, host: true },
  });
}

type BookingWithParties = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;
interface EmailContext {
  b: BookingWithParties;
  listing: BookingWithParties['listing'];
  guest: Party;
  host: Party;
  base: (me: Party, other: Party) => BookingEmailBase;
}
