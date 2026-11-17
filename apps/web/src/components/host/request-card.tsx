'use client';

import { rangesOverlap, type BookingDto } from '@hongwang/shared';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { formatStay, formatTHB, fromNow, pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RequestActions, type RequestOutcome } from './request-actions';
import { leftUntil, useNow } from './use-now';

/** Other pending requests for the same listing whose nights overlap this one. */
export function overlappingRequests(b: BookingDto, all: BookingDto[]) {
  return all.filter(
    (o) => o.id !== b.id && o.status === 'requested' && o.listing.id === b.listing.id && rangesOverlap(b.checkIn, b.checkOut, o.checkIn, o.checkOut),
  );
}

/** "Requests to respond to" card (design C2). */
export function RequestCard({
  booking,
  others,
  outcome,
  onDone,
}: {
  booking: BookingDto;
  /** Pending requests overlapping this one (warning line). */
  others: BookingDto[];
  /** Set once the host answered here, to show the result in place. */
  outcome?: RequestOutcome;
  onDone: (outcome: RequestOutcome, dto: BookingDto) => void;
}) {
  const now = useNow();
  const g = booking.guest;
  const left = booking.requestExpiresAt ? leftUntil(booking.requestExpiresAt, now) : null;
  return (
    <article className="flex flex-wrap items-start gap-5 rounded-panel border border-line bg-surface px-[22px] py-5">
      <span
        aria-hidden
        className="flex size-12 flex-none items-center justify-center rounded-full bg-subtle font-semibold text-ink"
      >
        {g.initials}
      </span>
      <div className="flex min-w-0 flex-[999_1_360px] flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="m-0 text-[17px] font-semibold">
            <Link href={`/host/reservations/${booking.id}`} className="text-ink no-underline hover:underline">
              {g.displayName}
            </Link>
          </h3>
          <span className="text-[13px] text-muted">
            Requested {fromNow(booking.createdAt)} · {booking.listing.title}
          </span>
        </div>
        <p className="m-0 font-medium">
          {formatStay(booking.checkIn, booking.checkOut)} · {pluralize(booking.nights, 'night')} ·{' '}
          {pluralize(booking.guests, 'guest')}
        </p>
        {booking.message && <p className="m-0 max-w-[62ch] text-ink-2">“{booking.message}”</p>}
        {!outcome && others.length > 0 && (
          <p className="m-0 mt-0.5 flex items-center gap-2 text-sm font-medium text-warn-ink">
            <AlertTriangle aria-hidden className="size-4 text-warn-icon" />
            Overlaps {others.map((o) => `${o.guest.firstName}’s`).join(' and ')} dates. Only one of these requests can
            be approved.
          </p>
        )}
      </div>
      <div className="flex flex-[1_1_240px] flex-col items-stretch gap-2.5">
        <div className="flex justify-between gap-3">
          <span className="text-sm text-ink-2">You earn</span>
          <strong className="font-semibold">{formatTHB(booking.pricing.hostPayout)}</strong>
        </div>
        {outcome ? (
          <p
            role="status"
            className={cn(
              'm-0 rounded-field px-3 py-2.5 text-sm font-medium',
              outcome === 'approved' ? 'bg-brand-soft text-brand-ink' : 'bg-subtle text-ink',
            )}
          >
            {outcome === 'approved'
              ? `Approved. ${g.firstName} has 15 minutes to pay before the dates are released.`
              : `Declined. ${g.firstName} has been told.`}
          </p>
        ) : (
          <>
            {left && (
              <p className="m-0 text-[13px] text-muted">
                {left === 'expired' ? 'This request has expired' : `Respond within ${left} or it expires`}
              </p>
            )}
            <RequestActions booking={booking} onDone={onDone} />
          </>
        )}
      </div>
    </article>
  );
}
