'use client';

import { daysBetween, todayInBangkok, type BookingDto } from '@hongwang/shared';
import Link from 'next/link';
import { ListingImage, tintFor } from '@/components/listings/listing-image';
import { Button } from '@/components/ui/button';
import { countdown, formatShortDay, formatStay, formatTHB } from '@/lib/format';
import { hoursLeft, listingHref, paidWith } from './booking-format';
import { GuestStatusBadge } from './booking-status';

type Action = { label: string; href: string; solid?: boolean };

/** The contextual line and actions of a trip card (design B1). */
export function tripCardContent(b: BookingDto, now: number, today = todayInBangkok()): { note: string; primary: Action; secondary?: Action } {
  const host = b.host.firstName;
  const trip = `/trips/${b.id}`;
  const cancel = `/trips/${b.id}?cancel=1`;
  switch (b.status) {
    case 'requested': {
      const left = b.requestExpiresAt ? hoursLeft(b.requestExpiresAt, now) : null;
      return {
        note: `${left ? `${host} has ${left} to respond.` : `Waiting for ${host}.`} You have not been charged.`,
        primary: { label: 'View request', href: trip },
        secondary: { label: 'Cancel request', href: cancel },
      };
    }
    case 'payment_hold': {
      const live = b.holdExpiresAt && Date.parse(b.holdExpiresAt) > now;
      return live
        ? {
            note: `Pay within ${countdown(b.holdExpiresAt!, now)} or the dates go back on sale.`,
            primary: { label: 'Pay now', href: `/checkout/${b.id}`, solid: true },
            secondary: { label: 'Cancel', href: cancel },
          }
        : {
            note: 'The payment hold ran out. You haven’t been charged.',
            primary: { label: 'Check the dates again', href: listingHref(b) },
          };
    }
    case 'confirmed': {
      const days = daysBetween(today, b.checkIn);
      const from = b.unlocked ? `, from ${b.unlocked.checkInFrom}` : '';
      const note =
        days > 1
          ? `Check-in in ${days} days${from}.`
          : days === 1
            ? `Check-in is tomorrow${from}.`
            : days === 0
              ? `Check-in is today${from}.`
              : today < b.checkOut
                ? `You’re staying here until ${formatShortDay(b.checkOut)}.`
                : 'Your stay has ended.';
      return { note, primary: { label: 'View trip', href: trip, solid: true } };
    }
    case 'completed':
      return {
        note: `Stayed ${b.nights} night${b.nights === 1 ? '' : 's'} with ${host}.`,
        primary: { label: 'View receipt', href: trip, solid: true },
        secondary: { label: 'Book again', href: `/rooms/${b.listing.id}` },
      };
    case 'cancelled': {
      const by = b.cancelledBy === 'guest' ? 'Cancelled' : b.cancelledBy === 'host' ? `${host} cancelled` : 'Cancelled by Hongwang';
      const when = b.cancelledAt ? ` on ${formatShortDay(todayInBangkok(new Date(b.cancelledAt)))}` : '';
      const money = b.refundAmount
        ? `Refunded ${formatTHB(b.refundAmount)} to ${paidWith(b.payment, true)}.`
        : b.payment?.paidAt
          ? 'No refund under the cancellation policy.'
          : 'You were not charged.';
      return { note: `${by}${when}. ${money}`, primary: { label: 'View details', href: trip } };
    }
    case 'rejected':
      return { note: `${host} could not host these dates. You were not charged.`, primary: { label: 'Find similar rooms', href: '/' } };
    case 'expired':
      return {
        note: b.holdExpiresAt
          ? 'The payment hold ran out before payment. You were not charged.'
          : `${host} didn’t respond in time. You were not charged.`,
        primary: { label: 'Check the dates again', href: listingHref(b) },
      };
  }
}

export function TripCard({ booking: b, now }: { booking: BookingDto; now: number }) {
  const { note, primary, secondary } = tripCardContent(b, now);
  return (
    <article className="flex flex-wrap items-center gap-5 rounded-panel border border-line p-4">
      <div className="relative h-[124px] w-full flex-none overflow-hidden rounded-[12px] sm:w-[168px]">
        <ListingImage src={b.listing.coverPhotoUrl} alt="" sizes="(min-width: 640px) 168px, 100vw" tint={tintFor(b.listing.id)} label="" />
      </div>
      <div className="flex min-w-0 flex-[999_1_320px] flex-col gap-1.5">
        <GuestStatusBadge booking={b} now={now} className="self-start text-[13px]" />
        <h2 className="m-0 text-lg leading-[1.3] font-semibold">{b.listing.title}</h2>
        <p className="m-0 text-ink-2">
          {formatStay(b.checkIn, b.checkOut)} · {b.listing.area}, Bangkok
        </p>
        <p className="m-0 text-sm text-muted">{note}</p>
      </div>
      <div className="flex flex-[1_1_180px] flex-col gap-2">
        <Button asChild variant={primary.solid ? 'primary' : 'outline'} block>
          <Link href={primary.href}>{primary.label}</Link>
        </Button>
        {secondary && (
          <Button asChild variant="outline" block>
            <Link href={secondary.href}>{secondary.label}</Link>
          </Button>
        )}
      </div>
    </article>
  );
}
