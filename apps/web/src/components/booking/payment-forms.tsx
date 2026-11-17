'use client';

import type { BookingDto, PaymentMethod } from '@hongwang/shared';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Appearance, type Stripe as StripeJs } from '@stripe/stripe-js';
import { QrCode } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { errorMessage } from '@/lib/api/client';
import { formatTHB } from '@/lib/format';
import { useSimulatePayment } from '@/lib/queries/bookings';

const stripePromises = new Map<string, Promise<StripeJs | null>>();
function getStripe(publishableKey: string) {
  let p = stripePromises.get(publishableKey);
  if (!p) {
    p = loadStripe(publishableKey);
    stripePromises.set(publishableKey, p);
  }
  return p;
}

/** Stripe Elements styled from the design tokens in globals.css (read at runtime, no hard-coded colours). */
function stripeAppearance(): Appearance {
  if (typeof window === 'undefined') return { theme: 'stripe' };
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim() || undefined;
  return {
    theme: 'stripe',
    variables: {
      colorPrimary: v('--color-brand'),
      colorText: v('--color-ink'),
      colorTextSecondary: v('--color-muted'),
      colorDanger: v('--color-danger'),
      colorBackground: v('--color-surface'),
      borderRadius: v('--radius-field'),
      fontFamily: 'Inter, system-ui, sans-serif',
    },
  };
}

export function PayButton({ amount, disabled, loading, onClick }: { amount: number; disabled?: boolean; loading?: boolean; onClick?: () => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Button size="xl" block disabled={disabled} loading={loading} onClick={onClick}>
        Pay {formatTHB(amount)}
      </Button>
      <p className="m-0 text-center text-[13px] text-muted">Test mode: no real money moves. Use card 4242 4242 4242 4242.</p>
    </div>
  );
}

interface PayFormProps {
  booking: BookingDto;
  method: PaymentMethod;
  /** Cancellation policy block, shown between the payment fields and the button (design A3). */
  policy: React.ReactNode;
  disabled?: boolean;
}

// ---------------------------------------------------------------- Stripe (test mode)

/**
 * Stripe Payment Element for the booking's PaymentIntent. `confirmPayment` only authorises the
 * payment: the booking is confirmed by the webhook, so on success the page switches to
 * "Confirming your payment…" and polls the booking.
 */
export function StripePayForm(props: PayFormProps & { clientSecret: string; publishableKey: string; onSubmitted: () => void }) {
  const options = useMemo(() => ({ clientSecret: props.clientSecret, appearance: stripeAppearance() }), [props.clientSecret]);
  return (
    // Remount per method: the API switches the PaymentIntent's payment_method_types in place.
    <Elements key={`${props.clientSecret}-${props.method}`} stripe={getStripe(props.publishableKey)} options={options}>
      <StripePayInner {...props} />
    </Elements>
  );
}

function StripePayInner({ booking, policy, disabled, onSubmitted }: PayFormProps & { onSubmitted: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: `${window.location.origin}/checkout/${booking.id}` },
    });
    if (result.error) {
      setError(result.error.message ?? 'Your payment didn’t go through. Please try again.');
      setSubmitting(false);
      return;
    }
    const status = result.paymentIntent?.status;
    if (status === 'succeeded' || status === 'processing') {
      onSubmitted(); // the webhook confirms the booking; the page polls for it
      return;
    }
    // e.g. the PromptPay QR was closed before paying
    setError('The payment wasn’t completed. You can try again.');
    setSubmitting(false);
  }

  return (
    <>
      <div className="min-h-40">
        <PaymentElement options={{ layout: 'tabs' }} onReady={() => setReady(true)} />
      </div>
      {error && (
        <p role="alert" className="m-0 rounded-field bg-danger-bg px-3.5 py-2.5 text-sm font-medium text-danger-ink">
          {error}
        </p>
      )}
      {policy}
      <PayButton amount={booking.pricing.total} disabled={disabled || !stripe || !ready} loading={submitting} onClick={() => void pay()} />
    </>
  );
}

// ---------------------------------------------------------------- simulated (no Stripe keys, dev only)

const BANKS = ['Kasikorn Bank', 'Siam Commercial Bank', 'Bangkok Bank', 'Krungthai Bank', 'Krungsri'];

/**
 * The design's test fields (A3), used when the API runs without Stripe keys. Nothing typed here
 * leaves the browser: "Pay" calls POST /payments/:id/simulate, which confirms through the same
 * code path as the Stripe webhook.
 */
export function SimulatedPayForm({ booking, method, policy, disabled, onPaid }: PayFormProps & { onPaid: (dto: BookingDto) => void }) {
  const simulate = useSimulatePayment(booking.id);
  const id = useId();
  const [bank, setBank] = useState('');

  return (
    <>
      {method === 'card' && (
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Card number" className="col-span-2">
            {(p) => <Input {...p} inputMode="numeric" autoComplete="off" defaultValue="4242 4242 4242 4242" />}
          </Field>
          <Field label="Expiry">{(p) => <Input {...p} autoComplete="off" defaultValue="12 / 28" />}</Field>
          <Field label="CVC">{(p) => <Input {...p} inputMode="numeric" autoComplete="off" defaultValue="123" />}</Field>
          <Field label="Name on card" className="col-span-2">
            {(p) => <Input {...p} autoComplete="off" placeholder="As printed on the card" />}
          </Field>
        </div>
      )}
      {method === 'promptpay' && (
        <div className="flex flex-wrap items-center gap-5 rounded-[14px] bg-canvas p-5">
          <div
            aria-hidden
            className="flex size-[168px] flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-disabled bg-surface text-center text-[13px] text-ink-2"
          >
            <QrCode className="size-10" />
            QR code
          </div>
          <p className="m-0 flex-[1_1_220px]">
            Scan with any Thai banking app. This page confirms by itself once the payment lands, usually within a few seconds.
            In test mode, press Pay to simulate the scan.
          </p>
        </div>
      )}
      {method === 'mobile_banking' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-bank`} className="text-sm font-semibold">
            Your bank
          </label>
          <Select id={`${id}-bank`} value={bank} onChange={(e) => setBank(e.target.value)}>
            <option value="">Choose a bank</option>
            {BANKS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </div>
      )}
      {simulate.isError && (
        <p role="alert" className="m-0 rounded-field bg-danger-bg px-3.5 py-2.5 text-sm font-medium text-danger-ink">
          {errorMessage(simulate.error)}
        </p>
      )}
      {policy}
      <PayButton
        amount={booking.pricing.total}
        disabled={disabled || (method === 'mobile_banking' && !bank)}
        loading={simulate.isPending}
        onClick={() => simulate.mutate(undefined, { onSuccess: onPaid })}
      />
    </>
  );
}
