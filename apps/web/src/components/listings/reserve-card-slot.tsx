'use client';

import type { ListingDetailDto } from '@hongwang/shared';
import { useQueryStates } from 'nuqs';
import { ReserveCard } from '@/components/booking/reserve-card';
import { stayParsers } from '@/components/search/search-params';

/**
 * Renders the Bookings module's <ReserveCard> with the dates and guests currently in the URL, so
 * picking dates in the availability calendar (which writes ?checkIn&checkOut) reaches the card.
 */
export function ReserveCardSlot({ listing }: { listing: ListingDetailDto }) {
  const [{ checkIn, checkOut, guests }] = useQueryStates(stayParsers);
  return (
    <ReserveCard
      listing={listing}
      initialCheckIn={checkIn ?? undefined}
      initialCheckOut={checkOut ?? undefined}
      initialGuests={guests ?? undefined}
    />
  );
}
