import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TripsView } from '@/components/booking/trips-view';

export const metadata: Metadata = { title: 'Trips' };

/** Trips (design B1). */
export default function TripsPage() {
  return (
    <Suspense>
      <TripsView />
    </Suspense>
  );
}
