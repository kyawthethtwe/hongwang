import type { Metadata } from 'next';
import { ReservationView } from '@/components/host/reservation-view';

export const metadata: Metadata = { title: 'Reservation' };

/** Host reservation detail and host cancellation (design C6). */
export default async function HostReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto box-border w-full max-w-[1120px] px-4 pt-5 pb-14 sm:px-10">
      <ReservationView id={id} />
    </main>
  );
}
