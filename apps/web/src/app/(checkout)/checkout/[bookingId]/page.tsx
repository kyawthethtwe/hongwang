import type { Metadata } from 'next';
import { CheckoutView } from '@/components/booking/checkout-view';

export const metadata: Metadata = { title: 'Confirm and pay' };

/** Checkout with payment hold (design A3). Client-rendered: it counts down and polls. */
export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ bookingId }, query] = await Promise.all([params, searchParams]);
  // Stripe sends the guest back here after a redirect-based payment step.
  const status = typeof query.redirect_status === 'string' ? query.redirect_status : null;
  return <CheckoutView bookingId={bookingId} returnedFromStripe={status === 'succeeded' || status === 'processing'} />;
}
