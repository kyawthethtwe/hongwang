'use client';

import { addDays, todayInBangkok, type BookingDto } from '@hongwang/shared';
import { Check, ChevronLeft, Lock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ListingImage, tintFor } from '@/components/listings/listing-image';
import { Button } from '@/components/ui/button';
import { Banner, Skeleton } from '@/components/ui/feedback';
import { Avatar, Card } from '@/components/ui/surfaces';
import { ApiError, errorMessage } from '@/lib/api/client';
import { loginHref } from '@/lib/auth/next-path';
import { countdown, formatDay, formatStay, formatStayShort, formatTHB, pluralize } from '@/lib/format';
import { useBooking } from '@/lib/queries/bookings';
import { formatMoment, hoursBefore, hoursLeft, listingHref, paidWith } from './booking-format';
import { guestCanCancel, GuestStatusBadge } from './booking-status';
import { CancelBookingDialog } from './cancel-booking-dialog';
import { PriceLines, PriceRow } from './price-lines';
import { StayTimeline, stayTimeline } from './stay-timeline';
import { useNow } from './use-now';

const comingSoon = 'Coming soon';

/** Owner: Bookings & Payments module. Trip detail and guest cancellation (design B2). */
export function TripDetailView({ bookingId, openCancel = false }: { bookingId: string; openCancel?: boolean }) {
  const query = useBooking(bookingId);
  const now = useNow(1000);
  const [cancelOpen, setCancelOpen] = useState(openCancel);
  const b = query.data;

  if (query.isLoading) {
    return (
      <main className="mx-auto box-border max-w-[1120px] px-4 pt-5 pb-14 sm:px-10" aria-busy>
        <Skeleton className="h-11 w-32" />
        <Skeleton className="mt-3 h-11 w-96 max-w-full" />
        <div className="mt-8 flex flex-wrap gap-12">
          <Skeleton className="h-96 min-w-0 flex-[999_1_520px]" />
          <Skeleton className="h-96 min-w-0 flex-[1_1_320px]" />
        </div>
      </main>
    );
  }
  if (query.error || !b) {
    const status = query.error instanceof ApiError ? query.error.status : 0;
    return (
      <main className="mx-auto box-border flex max-w-[1120px] flex-col gap-4 px-4 pt-10 pb-14 sm:px-10">
        <h1 className="m-0 font-display text-[34px] font-bold">
          {status === 401 ? 'Sign in to see this trip' : status === 404 ? 'We couldn’t find this trip' : 'Something went wrong'}
        </h1>
        <p className="m-0 text-ink-2">
          {status === 404 ? 'The link may be out of date, or the booking belongs to another account.' : errorMessage(query.error)}
        </p>
        <Button asChild className="self-start">
          {status === 401 ? <Link href={loginHref(`/trips/${bookingId}`)}>Sign in</Link> : <Link href="/trips">All trips</Link>}
        </Button>
      </main>
    );
  }

  const today = todayInBangkok();
  const host = b.host.firstName;
  const canCancel = guestCanCancel(b);

  return (
    <main className="mx-auto box-border max-w-[1120px] px-4 pt-5 pb-14 sm:px-10">
      <Link href="/trips" className="inline-flex min-h-11 items-center gap-1.5 font-medium no-underline">
        <ChevronLeft aria-hidden className="size-[18px]" />
        All trips
      </Link>
      <div className="mt-2 mb-1 flex flex-wrap items-center gap-3">
        <h1 className="m-0 font-display text-[30px] leading-[1.2] font-bold tracking-[-0.02em] sm:text-[34px]">{b.listing.title}</h1>
        <GuestStatusBadge booking={b} now={now} className="px-3 text-[13px]" />
      </div>
      <p className="m-0 mb-6 text-ink-2">
        {formatStay(b.checkIn, b.checkOut)} · {pluralize(b.nights, 'night')} · {pluralize(b.guests, 'guest')} · Booking ref {b.ref}
      </p>

      <StatusBanner booking={b} now={now} />

      <div className="flex flex-wrap items-start gap-12">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-7">
          <StayTimeline steps={stayTimeline(b, now, today)} />
          <GettingIn booking={b} />

          <section aria-labelledby="host-title" className="flex flex-wrap items-center gap-4 border-b border-line pb-6">
            <Avatar name={b.host.displayName} initials={b.host.initials} src={b.host.avatarUrl} size={52} />
            <div className="min-w-0 flex-[1_1_240px]">
              <h2 id="host-title" className="m-0 text-lg font-semibold">
                {host} is your host
              </h2>
              <p className="m-0 mt-0.5 text-ink-2">
                {b.unlocked?.hostPhone
                  ? `Phone ${b.unlocked.hostPhone}`
                  : b.unlocked
                    ? 'Contact details are in your confirmation email'
                    : 'Contact details unlock when you pay'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button disabled aria-describedby="message-soon">
                Message {host}
              </Button>
              <span id="message-soon" className="text-xs text-muted">
                Messaging is {comingSoon.toLowerCase()}
              </span>
            </div>
          </section>

          <section aria-labelledby="manage-title" className="flex flex-col gap-3">
            <h2 id="manage-title" className="m-0 text-xl font-semibold">
              Manage booking
            </h2>
            {canCancel ? (
              <div className="flex flex-wrap gap-2">
                {b.status !== 'requested' && (
                  <Button variant="outline" disabled title={comingSoon} aria-describedby="change-soon">
                    Ask to change dates <span id="change-soon" className="text-xs font-medium text-muted">({comingSoon.toLowerCase()})</span>
                  </Button>
                )}
                <Button variant="danger-outline" aria-haspopup="dialog" aria-expanded={cancelOpen} onClick={() => setCancelOpen(true)}>
                  {b.status === 'requested' ? 'Cancel request' : 'Cancel booking'}
                </Button>
              </div>
            ) : (
              <p className="m-0 text-ink-2">
                {b.status === 'completed'
                  ? 'This stay is over. Reviews open after check-out.'
                  : 'This booking is closed, so there’s nothing to change.'}
              </p>
            )}
          </section>

          {(b.status === 'confirmed' || b.status === 'completed') && (
            <Card className="flex flex-col gap-3 bg-canvas">
              <h2 className="m-0 text-base font-semibold">Something wrong when you arrive?</h2>
              <p className="m-0 text-ink-2">
                Report a problem within 24 hours of check-in and the host’s payout stays on hold while we look into it.
              </p>
              <Button variant="outline" className="self-start" disabled title={comingSoon}>
                Report a problem ({comingSoon.toLowerCase()})
              </Button>
            </Card>
          )}
        </div>

        <Receipt booking={b} />
      </div>

      {canCancel && <CancelBookingDialog booking={b} open={cancelOpen} onOpenChange={setCancelOpen} />}
    </main>
  );
}

function StatusBanner({ booking: b, now }: { booking: BookingDto; now: number }) {
  const host = b.host.firstName;
  const banner = (() => {
    switch (b.status) {
      case 'cancelled': {
        const lead = b.cancelledBy === 'host' ? `${host} cancelled this booking.` : 'Booking cancelled.';
        const money = b.refundAmount
          ? `${formatTHB(b.refundAmount)} is on its way back to ${paidWith(b.payment, true)} and should arrive within 5–10 business days.`
          : b.payment?.paidAt
            ? 'No refund applies under the cancellation policy.'
            : 'You weren’t charged.';
        return (
          <Banner tone="danger" icon={false} title={lead}>
            {money} The dates are open to other guests again.
          </Banner>
        );
      }
      case 'payment_hold': {
        const live = b.holdExpiresAt && Date.parse(b.holdExpiresAt) > now;
        return live ? (
          <Banner
            tone="warn"
            title={`${formatStayShort(b.checkIn, b.checkOut)} is held for you.`}
            action={
              <Button asChild>
                <Link href={`/checkout/${b.id}`}>Pay now</Link>
              </Button>
            }
          >
            Pay within <strong className="font-bold font-tabular">{countdown(b.holdExpiresAt!, now)}</strong> or the dates go back on sale.
          </Banner>
        ) : (
          <Banner
            tone="danger"
            icon={false}
            title="This hold has expired."
            action={
              <Button asChild variant="danger-outline">
                <Link href={listingHref(b)}>Check the dates again</Link>
              </Button>
            }
          >
            The dates are back on sale and you haven’t been charged.
          </Banner>
        );
      }
      case 'requested': {
        const left = b.requestExpiresAt ? hoursLeft(b.requestExpiresAt, now) : null;
        return (
          <Banner tone="info" title="Request sent.">
            {left ? `${host} has ${left} to respond.` : `Waiting for ${host}.`} You haven’t been charged. If {host} accepts, you’ll
            have 15 minutes to pay.
          </Banner>
        );
      }
      case 'rejected':
        return (
          <Banner
            tone="info"
            title={`${host} can’t host these dates.`}
            action={
              <Button asChild variant="outline">
                <Link href="/">Find similar rooms</Link>
              </Button>
            }
          >
            You weren’t charged.
          </Banner>
        );
      case 'expired':
        return (
          <Banner
            tone="info"
            title={b.holdExpiresAt ? 'The payment hold ran out.' : `${host} didn’t respond in time.`}
            action={
              <Button asChild variant="outline">
                <Link href={listingHref(b)}>Check the dates again</Link>
              </Button>
            }
          >
            You weren’t charged.
          </Banner>
        );
      default:
        return null;
    }
  })();
  return banner ? <div className="mb-6">{banner}</div> : null;
}

function GettingIn({ booking: b }: { booking: BookingDto }) {
  const u = b.unlocked;
  const host = b.host.firstName;
  return (
    <section aria-labelledby="getting-in-title" className="flex flex-col gap-3.5 rounded-panel bg-canvas p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="getting-in-title" className="m-0 text-lg font-semibold">
          Getting in
        </h2>
        {u ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-hover">
            <Check aria-hidden className="size-3.5" strokeWidth={2.6} />
            Unlocked when you paid
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted">
            <Lock aria-hidden className="size-3.5" />
            Unlocked when you pay
          </span>
        )}
      </div>
      {u ? (
        <>
          <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Address</dt>
              <dd className="m-0 mt-0.5 text-ink-2">{u.address}</dd>
            </div>
            <div>
              <dt className="font-semibold">Keycard code</dt>
              <dd className="m-0 mt-0.5 text-ink-2">
                From {host} on {formatDay(b.checkIn)}, around {hoursBefore(u.checkInFrom, 4)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Check-in</dt>
              <dd className="m-0 mt-0.5 text-ink-2">From {u.checkInFrom}</dd>
            </div>
            <div>
              <dt className="font-semibold">Check-out</dt>
              <dd className="m-0 mt-0.5 text-ink-2">By {u.checkOutBy}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            {u.location && (
              <Button asChild variant="outline-dark">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${u.location.lat},${u.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get directions
                </a>
              </Button>
            )}
            <Button variant="outline" className="font-medium" onClick={() => downloadIcs(b)}>
              Add to calendar
            </Button>
          </div>
        </>
      ) : (
        <p className="m-0 text-ink-2">
          The exact address, check-in details and {host}’s phone number appear here once your payment is confirmed.
        </p>
      )}
    </section>
  );
}

function Receipt({ booking: b }: { booking: BookingDto }) {
  const p = b.payment;
  const paid = !!p?.paidAt;
  return (
    <aside aria-label="Receipt" className="min-w-0 flex-[1_1_320px]">
      <div className="flex flex-col gap-3.5 rounded-sheet border border-line-card p-5">
        <div className="relative h-[150px] overflow-hidden rounded-[12px]">
          <ListingImage src={b.listing.coverPhotoUrl} alt="" sizes="360px" tint={tintFor(b.listing.id)} label="" />
        </div>
        <h2 className="m-0 text-lg font-semibold">Receipt</h2>
        <PriceLines
          pricing={b.pricing}
          totalLabel={paid ? 'Paid' : 'Total'}
          extra={b.refundAmount ? <PriceRow label="Refunded" value={formatTHB(-b.refundAmount)} /> : undefined}
        />
        <p className="m-0 text-sm text-muted">
          {paid ? `${paidWith(p)} · ${formatMoment(p!.paidAt!)}` : 'Not charged yet. Price locked when you reserved.'}
        </p>
        <Button variant="outline" className="font-medium" disabled title="Coming soon">
          Download receipt (PDF)
        </Button>
      </div>
    </aside>
  );
}

/** All-day calendar event for the stay (check-out day included), as an .ics download. */
function downloadIcs(b: BookingDto) {
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const day = (d: string) => d.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hongwang//Trips//EN',
    'BEGIN:VEVENT',
    `UID:${b.id}@hongwang`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day(b.checkIn)}`,
    `DTEND;VALUE=DATE:${day(addDays(b.checkOut, 1))}`,
    `SUMMARY:${esc(`Stay: ${b.listing.title}`)}`,
    ...(b.unlocked ? [`LOCATION:${esc(b.unlocked.address)}`] : []),
    `DESCRIPTION:${esc(
      `Booking ${b.ref}. Check-in from ${b.unlocked?.checkInFrom ?? '-'}, check-out by ${b.unlocked?.checkOutBy ?? '-'}.`,
    )}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${b.ref}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
