import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SavedRooms } from '@/components/listings/saved-rooms';

export const metadata: Metadata = { title: 'Saved' };

/** Saved rooms (design B5). Suspense: the grid reads ?checkIn&checkOut on the client. */
export default function SavedPage() {
  return (
    <Suspense>
      <SavedRooms />
    </Suspense>
  );
}
