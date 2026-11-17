'use client';

import { ERROR_CODES, todayInBangkok, type BookingDto, type PaymentMethod } from '@hongwang/shared';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Banner, Skeleton } from '@/components/ui/feedback';
import { RadioCard } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, errorMessage } from '@/lib/api/client';
import { loginHref } from '@/lib/auth/next-path';
import { countdown, formatDay, formatStayShort } from '@/lib/format';
import { useBooking, usePaymentIntent } from '@/lib/queries/bookings';
import { cancellationSummary, hoursLeft, listingHref } from './booking-format';
import { BookingSummary } from './booking-summary';
import { PayButton, SimulatedPayForm, StripePayForm } from './payment-forms';
import { ProgressSteps, type StepState } from './progress-steps';
import { useNow } from './use-now';

const METHODS: { id: PaymentMethod; title: string; sub: string }[] = [
  { id: 'card', title: 'Credit or debit card', sub: 'Visa, Mastercard, JCB' },
  { id: 'promptpay', title: 'PromptPay QR', sub: 'Scan with any Thai banking app' },
  { id: 'mobile_banking', title: 'Mobile banking', sub: 'Approve in your bank app' },
];

/** After this long without a webhook, say so (the page keeps polling). */
const SLOW_CONFIRM_MS = 45_000;

/**
 * Owner: Bookings & Payments module. Checkout with payment hold (design A3): live m:ss countdown,
 * pay with Stripe Elements (or the simulated test form without Stripe keys), then "Now unlocked".
 * The booking turns `confirmed` only through the webhook/simulator, so after paying the page polls.
 */
export function CheckoutView({ bookingId, returnedFromStripe = false }: { bookingId: string; returnedFromStripe?: boolean }) {
  const [confirmingSince, setConfirmingSince] = useState<number | null>(() => (returnedFromStripe ? Date.now() : null));
  const confirming = confirmingSince !== null;
  const query = useBooking(bookingId, { pollMs: confirming ? 1500 : false });
  const b = query.data;
  const now = useNow(1000);

  const paid = b?.status === 'confirmed' || b?.status === 'completed';
  const holdOver = b?.status === 'payment_hold' && (!b.holdExpiresAt || Date.parse(b.holdExpiresAt) <= now);
  useEffect(() => {
    if (paid) setConfirmingSince(null);
  }, [paid]);
  // When the countdown hits zero, ask the server what happened (the worker expires the hold).
  const { refetch } = query;
  useEffect(() => {
    if (holdOver && !confirming) void refetch();
  }, [holdOver, confirming, refetch]);
  const startConfirming = useCallback(() => setConfirmingSince((t) => t ?? Date.now()), []);
  const reloadBooking = useCallback(() => void refetch(), [refetch]);

  if (query.isLoading) return <CheckoutSkeleton />;
  if (query.error || !b) return <CheckoutError error={query.error} bookingId={bookingId} />;
  if (b.viewerRole !== 'guest') {
    return (
      <Shell>
        <h1 className="m-0 font-display text-[34px] font-bold">This checkout is for the guest</h1>
        <p className="m-0 text-ink-2">Only {b.guest.firstName} can pay for booking {b.ref}.</p>
        {b.viewerRole === 'host' && (
          <Button asChild variant="outline" className="self-start">
            <Link href={`/host/reservations/${b.id}`}>Open the reservation</Link>
          </Button>
        )}
      </Shell>
    );
  }

  const host = b.host.firstName;
  const expired = !paid && !confirming && (b.status === 'expired' || holdOver);
  const heading = paid ? `You are going to ${b.listing.area}` : b.status === 'requested' ? `Waiting for ${host}` : 'Confirm and pay';
  const steps: { label: string; state: StepState }[] =
    b.status === 'requested'
      ? [
          { label: 'Request sent', state: 'done' },
          { label: `${host} accepts`, state: 'current' },
          { label: 'Pay within 15 min', state: 'later' },
        ]
      : [
          { label: 'Dates chosen', state: 'done' },
          { label: 'Pay within 15 min', state: paid ? 'done' : 'current' },
          { label: 'Booking confirmed', state: paid ? 'current' : 'later' },
        ];
  const today = todayInBangkok();
  const policy = (
    <div className="flex flex-col gap-1.5">
      <h2 className="m-0 text-base font-semibold">Cancellation policy</h2>
      <p className="m-0 text-ink-2">{cancellationSummary(b.cancellationPolicy, b.freeCancellationUntil, b.checkIn, today)}</p>
    </div>
  );

  return (
    <div className="mx-auto box-border max-w-[1120px] px-4 pt-5 pb-14 sm:px-10">
      <Link href={listingHref(b)} className="inline-flex min-h-11 items-center gap-1.5 font-medium no-underline">
        <ChevronLeft aria-hidden className="size-[18px]" />
        Back to listing
      </Link>
      <h1 className="mt-2 mb-5 font-display text-[30px] leading-[1.15] font-bold tracking-[-0.02em] sm:text-4xl">{heading}</h1>
      <ProgressSteps steps={steps} />

      <div className="mb-7">
        {paid ? (
          <Banner tone="success" title="Payment received. Your stay is confirmed.">
            The address and {host}’s contact details are now unlocked.
          </Banner>
        ) : confirming ? (
          <div role="status" className="flex items-center gap-3.5 rounded-card border border-brand-line bg-brand-soft px-5 py-4 text-brand-ink">
            <Spinner className="size-[22px] shrink-0" />
            <p className="m-0">
              <strong className="font-semibold">Confirming your payment…</strong>{' '}
              {confirmingSince !== null && now - confirmingSince > SLOW_CONFIRM_MS
                ? 'This is taking longer than usual. We’ll email you as soon as your bank confirms; you can safely leave this page.'
                : 'This page updates by itself, usually within a few seconds.'}
            </p>
          </div>
        ) : expired ? (
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
        ) : b.status === 'payment_hold' && b.holdExpiresAt ? (
          <Banner tone="warn" title={`${formatStayShort(b.checkIn, b.checkOut)} is held for you.`}>
            Pay within{' '}
            <strong className="font-bold font-tabular" aria-live="off">
              {countdown(b.holdExpiresAt, now)}
            </strong>{' '}
            or the dates go back on sale to other guests.
          </Banner>
        ) : b.status === 'requested' ? (
          <Banner tone="info" title="Request sent.">
            {b.requestExpiresAt && hoursLeft(b.requestExpiresAt, now)
              ? `${host} has ${hoursLeft(b.requestExpiresAt, now)} to respond.`
              : `${host} will respond soon.`}{' '}
            If they accept, we’ll email you a link and hold the dates for 15 minutes while you pay. You haven’t been charged.
          </Banner>
        ) : b.status === 'rejected' ? (
          <Banner tone="info" title={`${host} can’t host these dates.`}>
            You weren’t charged.
          </Banner>
        ) : (
          <Banner tone="danger" title="This booking was cancelled.">
            {b.refundAmount ? 'Your refund is on its way.' : 'You weren’t charged.'}
          </Banner>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-12">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-7">
          {paid ? (
            <Unlocked booking={b} />
          ) : b.status === 'payment_hold' && !confirming ? (
            <PaySection
              booking={b}
              expired={expired}
              policy={policy}
              onSubmitted={startConfirming}
              onHoldExpired={reloadBooking}
            />
          ) : (
            <div className="flex flex-wrap gap-2.5">
              <Button asChild size="lg">
                <Link href={`/trips/${b.id}`}>{b.status === 'requested' ? 'View your request' : 'View your trip'}</Link>
              </Button>
              {(b.status === 'rejected' || b.status === 'expired' || b.status === 'cancelled') && (
                <Button asChild size="lg" variant="outline-dark">
                  <Link href="/">Find other rooms</Link>
                </Button>
              )}
            </div>
          )}
        </div>
        <BookingSummary booking={b} />
      </div>
    </div>
  );
}

function PaySection({
  booking,
  expired,
  policy,
  onSubmitted,
  onHoldExpired,
}: {
  booking: BookingDto;
  expired: boolean;
  policy: React.ReactNode;
  onSubmitted: () => void;
  onHoldExpired: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('card');
  const intent = usePaymentIntent(booking.id, method, !expired);
  const code = intent.error instanceof ApiError ? intent.error.code : null;

  useEffect(() => {
    if (code === ERROR_CODES.holdExpired) onHoldExpired();
    if (code === 'PAYMENT_PROCESSING') onSubmitted();
  }, [code, onHoldExpired, onSubmitted]);

  return (
    <>
      <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className="mb-3 p-0 text-xl font-semibold">Pay with</legend>
        {METHODS.map((m) => (
          <RadioCard
            key={m.id}
            name="method"
            value={m.id}
            checked={method === m.id}
            onChange={() => setMethod(m.id)}
            title={m.title}
            sub={m.sub}
            disabled={expired}
          />
        ))}
      </fieldset>

      {expired ? (
        <>
          {policy}
          <PayButton amount={booking.pricing.total} disabled />
        </>
      ) : intent.isPending ? (
        <>
          <Skeleton className="h-40" />
          {policy}
          <PayButton amount={booking.pricing.total} disabled />
        </>
      ) : intent.isError ? (
        <>
          <p role="alert" className="m-0 rounded-field bg-danger-bg px-3.5 py-2.5 text-sm font-medium text-danger-ink">
            {errorMessage(intent.error, 'We couldn’t start the payment.')}{' '}
            <button type="button" className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-danger-ink underline" onClick={() => void intent.refetch()}>
              Try again
            </button>
          </p>
          {policy}
          <PayButton amount={booking.pricing.total} disabled />
        </>
      ) : intent.data.mode === 'stripe' && intent.data.clientSecret && intent.data.publishableKey ? (
        <StripePayForm
          booking={booking}
          method={method}
          policy={policy}
          clientSecret={intent.data.clientSecret}
          publishableKey={intent.data.publishableKey}
          onSubmitted={onSubmitted}
        />
      ) : (
        <SimulatedPayForm booking={booking} method={method} policy={policy} onPaid={() => undefined} />
      )}
    </>
  );
}

function Unlocked({ booking: b }: { booking: BookingDto }) {
  const u = b.unlocked;
  const host = b.host.firstName;
  return (
    <section aria-label="Your booking details" className="flex flex-col gap-[18px]">
      <h2 className="m-0 text-xl font-semibold">Now unlocked</h2>
      <dl className="m-0 flex flex-col gap-3.5">
        <div>
          <dt className="font-semibold">Address</dt>
          <dd className="m-0 mt-0.5 text-ink-2">{u?.address ?? 'Shown in your trip'}</dd>
        </div>
        <div>
          <dt className="font-semibold">Your host</dt>
          <dd className="m-0 mt-0.5 text-ink-2">
            {host}
            {u?.hostPhone ? ` · phone ${u.hostPhone}` : ''}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Check-in</dt>
          <dd className="m-0 mt-0.5 text-ink-2">
            {formatDay(b.checkIn)}
            {u ? ` from ${u.checkInFrom}` : ''} · check-out {formatDay(b.checkOut)}
            {u ? ` by ${u.checkOutBy}` : ''}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2.5">
        <Button asChild size="lg">
          <Link href={`/trips/${b.id}`}>View your trip</Link>
        </Button>
        {/* Messaging is phase 2: the trip page has the host's phone for now. */}
        <Button asChild size="lg" variant="outline-dark">
          <Link href={`/trips/${b.id}`}>Message {host}</Link>
        </Button>
      </div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto box-border flex max-w-[1120px] flex-col gap-4 px-4 pt-10 pb-14 sm:px-10">{children}</div>;
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto box-border max-w-[1120px] px-4 pt-5 pb-14 sm:px-10" aria-busy>
      <Skeleton className="h-11 w-40" />
      <Skeleton className="mt-3 h-11 w-72" />
      <Skeleton className="mt-6 h-16 w-full" />
      <div className="mt-7 flex flex-wrap gap-12">
        <Skeleton className="h-80 min-w-0 flex-[999_1_520px]" />
        <Skeleton className="h-80 min-w-0 flex-[1_1_340px]" />
      </div>
    </div>
  );
}

function CheckoutError({ error, bookingId }: { error: unknown; bookingId: string }) {
  const status = error instanceof ApiError ? error.status : 0;
  return (
    <Shell>
      <h1 className="m-0 font-display text-[34px] font-bold">
        {status === 401 ? 'Sign in to pay' : status === 404 || status === 403 ? 'We couldn’t find this booking' : 'Something went wrong'}
      </h1>
      <p className="m-0 text-ink-2">
        {status === 401
          ? 'Your session has ended. Sign in again to finish your booking.'
          : status === 404 || status === 403
            ? 'The link may be out of date, or the booking belongs to another account.'
            : errorMessage(error)}
      </p>
      <Button asChild className="self-start">
        {status === 401 ? <Link href={loginHref(`/checkout/${bookingId}`)}>Sign in</Link> : <Link href="/trips">Go to your trips</Link>}
      </Button>
    </Shell>
  );
}
