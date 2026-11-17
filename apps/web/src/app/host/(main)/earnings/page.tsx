import type { Metadata } from 'next';
import { EarningsView } from '@/components/host/earnings-view';

export const metadata: Metadata = { title: 'Earnings' };

/** Earnings (design C7 is phase 2; this is the phase-1 "upcoming payouts" page). */
export default function HostEarningsPage() {
  return (
    <main className="mx-auto box-border w-full max-w-[1200px] px-4 pt-8 pb-14 sm:px-10">
      <EarningsView />
    </main>
  );
}
