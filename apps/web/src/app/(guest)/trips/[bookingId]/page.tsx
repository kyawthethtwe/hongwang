import type { Metadata } from 'next';
import { TripDetailView } from '@/components/booking/trip-detail-view';

export const metadata: Metadata = { title: 'Your trip' };

/** Trip detail and guest cancellation (design B2). `?cancel=1` opens the cancel dialog (from the trip cards). */
export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ bookingId }, query] = await Promise.all([params, searchParams]);
  return <TripDetailView bookingId={bookingId} openCancel={query.cancel === '1'} />;
}
