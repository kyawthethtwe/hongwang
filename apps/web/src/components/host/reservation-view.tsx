'use client';

import { addDays, todayInBangkok, type BookingDto } from '@hongwang/shared';
import { format, parseISO } from 'date-fns';
import { BadgeCheck, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { formatDay, formatStay, formatStayShort, formatTHB, pluralize } from '@/lib/format';
import { useHostReservation } from '@/lib/queries/host';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Avatar, PageTitle } from '@/components/ui/surfaces';
import { CancelReservationDialog } from './cancel-reservation-dialog';
import { PageSkeleton, QueryError } from './query-state';
import { RequestActions } from './request-actions';
import { BookingStatusBadge } from './status-badge';
import { leftUntil, useNow } from './use-now';

const card = 'rounded-panel border border-line bg-surface p-5';

function StatusBanner({ b }: { b: BookingDto }) {
  const first = b.guest.firstName;
  const dates = formatStayShort(b.checkIn, b.checkOut);
  if (b.status === 'cancelled') {
    if (b.cancelledBy === 'host') {
      return (
        <Banner tone="danger" title="Reservation cancelled." icon={false} className="mb-6">
          {first} gets a full refund{b.refundAmount !== null ? ` of ${formatTHB(b.refundAmount)}` : ''}.
          {b.hostPenalty ? ` A ${formatTHB(b.hostPenalty)} fee comes out of your next payout.` : ''}
        </Banner>
      );
    }
    return (
      <Banner tone="danger" title="Reservation cancelled." icon={false} className="mb-6">
        {b.cancelledBy === 'guest' ? `${first} cancelled ${dates}.` : `This stay was cancelled by Hongwang support.`}
        {b.refundAmount !== null ? ` Refund to the guest: ${formatTHB(b.refundAmount)}.` : ''} {dates} are open for
        booking again.
      </Banner>
    );
  }
  if (b.status === 'rejected') {
    return (
      <Banner tone="info" className="mb-6">
        You declined this request. {first} wasn’t charged.
      </Banner>
    );
  }
  if (b.status === 'expired') {
    return (
      <Banner tone="info" className="mb-6">
        {b.requestExpiresAt && !b.holdExpiresAt
          ? `This request expired before it was answered. ${first} wasn’t charged.`
          : `${first} didn’t pay in time, so the dates were released. Nobody was charged.`}
      </Banner>
    );
  }
  return null;
}

function Manage({ b }: { b: BookingDto }) {
  const now = useNow(15_000);
  const today = todayInBangkok(new Date(now));
  const first = b.guest.firstName;
  let body: React.ReactNode;
  if (b.status === 'requested') {
    body = (
      <>
        <p className="m-0 text-ink-2">
          {first} is waiting for your answer
          {b.requestExpiresAt ? `. Respond within ${leftUntil(b.requestExpiresAt, now)} or the request expires.` : '.'}
        </p>
        <RequestActions booking={b} className="max-w-md" />
      </>
    );
  } else if (b.status === 'payment_hold') {
    body = (
      <p className="m-0 text-ink-2">
        The dates are held while {first} pays
        {b.holdExpiresAt ? ` (${leftUntil(b.holdExpiresAt, now)} left)` : ''}. If payment doesn’t arrive in time,
        they’re released and nobody is charged.
      </p>
    );
  } else if (b.status === 'confirmed' && b.checkOut > today) {
    body = (
      <div className="flex flex-wrap gap-2">
        <CancelReservationDialog booking={b} />
      </div>
    );
  } else {
    body = <p className="m-0 text-muted">Nothing to do for this reservation.</p>;
  }
  return (
    <section aria-labelledby="manage-title" className={`${card} flex flex-col gap-3`}>
      <h2 id="manage-title" className="m-0 text-lg font-semibold">
        Manage
      </h2>
      {body}
    </section>
  );
}

function Payout({ b }: { b: BookingDto }) {
  const p = b.pricing;
  const prices = new Set(p.nightly.map((n) => n.price));
  const nightsLabel =
    prices.size === 1 ? `${formatTHB(p.nightly[0]!.price)} × ${pluralize(b.nights, 'night')}` : pluralize(b.nights, 'night');
  const cancelled = b.status === 'cancelled' || b.status === 'rejected' || b.status === 'expired';
  const releaseDay = addDays(b.checkIn, 1);
  const row = 'flex justify-between gap-3';
  return (
    <aside aria-labelledby="payout-title" className="min-w-0 flex-[1_1_320px]">
      <div className={`${card} flex flex-col gap-3.5`}>
        <h2 id="payout-title" className="m-0 text-lg font-semibold">
          Your payout
        </h2>
        <dl className="m-0 flex flex-col gap-2.5">
          <div className={row}>
            <dt className="text-ink-2">{nightsLabel}</dt>
            <dd className="m-0 font-tabular">{formatTHB(p.nightsSubtotal)}</dd>
          </div>
          {p.weeklyDiscount > 0 && (
            <div className={row}>
              <dt className="text-ink-2">Weekly discount</dt>
              <dd className="m-0 font-tabular">{formatTHB(-p.weeklyDiscount)}</dd>
            </div>
          )}
          <div className={row}>
            <dt className="text-ink-2">Cleaning fee</dt>
            <dd className="m-0 font-tabular">{formatTHB(p.cleaningFee)}</dd>
          </div>
          <div className={row}>
            <dt className="text-ink-2">Host fee (5% of nights)</dt>
            <dd className="m-0 font-tabular">{formatTHB(-p.hostFee)}</dd>
          </div>
          <div className={`${row} border-t border-line pt-3 font-semibold`}>
            <dt>You get</dt>
            <dd className="m-0 font-tabular">{formatTHB(cancelled ? 0 : p.hostPayout)}</dd>
          </div>
        </dl>
        <p className="m-0 text-sm text-ink-2">
          {b.status === 'cancelled'
            ? b.hostPenalty
              ? `No payout for this stay. The ${formatTHB(b.hostPenalty)} fee is taken from your next payout.`
              : 'No payout for this stay.'
            : cancelled
              ? 'No payout: this booking didn’t go ahead.'
              : b.status === 'completed'
                ? `Released ${formatDay(releaseDay)}, 24 hours after check-in.`
                : `Releases ${formatDay(releaseDay)}, 24 hours after check-in. Bank payouts through Stripe Connect arrive in phase 2.`}
        </p>
        <Link href="/host/earnings" className="text-sm font-medium">
          See all payouts
        </Link>
      </div>
    </aside>
  );
}

/** Host reservation detail (design C6). */
export function ReservationView({ id }: { id: string }) {
  const { data: b, error, isLoading, refetch } = useHostReservation(id);

  return (
    <>
      <Link href="/host" className="inline-flex min-h-11 items-center gap-1.5 font-medium no-underline">
        <ChevronLeft aria-hidden className="size-[18px]" />
        Today
      </Link>
      {isLoading ? (
        <PageSkeleton rows={3} />
      ) : error || !b ? (
        <QueryError error={error} retry={() => void refetch()} what="this reservation" />
      ) : (
        <>
          <div className="mt-2 mb-1 flex flex-wrap items-center gap-3">
            <PageTitle>
              {b.guest.displayName} · {pluralize(b.nights, 'night')}
            </PageTitle>
            <BookingStatusBadge booking={b} className="px-3 text-[13px]" />
          </div>
          <p className="m-0 mb-6 text-ink-2">
            {b.listing.title} · {formatStay(b.checkIn, b.checkOut)} · {pluralize(b.guests, 'guest')} · Ref {b.ref}
          </p>
          <StatusBanner b={b} />

          <div className="flex flex-wrap items-start gap-8">
            <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
              <section aria-label="Guest" className={`${card} flex flex-wrap items-center gap-4`}>
                <Avatar
                  name={b.guest.displayName}
                  initials={b.guest.initials}
                  src={b.guest.avatarUrl}
                  size={64}
                  className="bg-info-bg text-info-ink"
                />
                <div className="flex-[1_1_260px]">
                  <h2 className="m-0 text-[19px] font-semibold">{b.guest.displayName}</h2>
                  <p className="m-0 mt-0.5 flex flex-wrap items-center gap-1.5 text-ink-2">
                    {b.guest.identityVerified ? (
                      <>
                        <BadgeCheck aria-hidden className="size-4 text-brand" /> Identity verified
                      </>
                    ) : (
                      'Identity not verified yet'
                    )}{' '}
                    · Joined {format(parseISO(b.guest.joinedAt), 'yyyy')}
                  </p>
                  {b.guest.about && <p className="m-0 mt-1.5 text-ink-2">“{b.guest.about}”</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <Button disabled title="Messaging is coming soon">
                    Message {b.guest.firstName}
                  </Button>
                  <span className="text-[13px] text-muted">Messaging is coming soon</span>
                  {b.unlocked?.guestPhone && (
                    <span className="text-sm text-ink-2">
                      Phone <a href={`tel:${b.unlocked.guestPhone}`}>{b.unlocked.guestPhone}</a>
                    </span>
                  )}
                </div>
              </section>

              {b.message && (
                <section aria-label="Message from the guest" className={card}>
                  <h2 className="m-0 mb-2 text-lg font-semibold">{b.guest.firstName}’s message</h2>
                  <p className="m-0 text-ink-2">“{b.message}”</p>
                </section>
              )}

              <section aria-labelledby="stay-title" className={card}>
                <h2 id="stay-title" className="m-0 mb-3.5 text-lg font-semibold">
                  Stay details
                </h2>
                <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-ink-2">Check-in</dt>
                    <dd className="m-0 mt-0.5 font-semibold">
                      {formatDay(b.checkIn)}
                      {b.unlocked ? ` from ${b.unlocked.checkInFrom}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-ink-2">Check-out</dt>
                    <dd className="m-0 mt-0.5 font-semibold">
                      {formatDay(b.checkOut)}
                      {b.unlocked ? ` by ${b.unlocked.checkOutBy}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-ink-2">Keycard code</dt>
                    <dd className="m-0 mt-0.5 font-semibold">Sent automatically on check-in day</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-ink-2">Booked</dt>
                    <dd className="m-0 mt-0.5 font-semibold">
                      {format(parseISO(b.createdAt), 'EEE, MMM d, HH:mm')} · {b.instant ? 'Instant book' : 'Request to book'}
                    </dd>
                  </div>
                </dl>
              </section>

              <Manage b={b} />
            </div>
            <Payout b={b} />
          </div>
        </>
      )}
    </>
  );
}
