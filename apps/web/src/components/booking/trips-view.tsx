'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Tabs, TabsContent } from '@/components/ui/overlays';
import { PageTitle } from '@/components/ui/surfaces';
import { errorMessage } from '@/lib/api/client';
import { useMyBookings, type TripsTab } from '@/lib/queries/bookings';
import { TripCard } from './trip-card';
import { useNow } from './use-now';

const TABS = ['upcoming', 'past', 'cancelled'] as const satisfies readonly TripsTab[];
const LABELS: Record<TripsTab, string> = { upcoming: 'Upcoming', past: 'Past', cancelled: 'Cancelled' };
const EMPTY: Record<TripsTab, { title: string; body: string }> = {
  upcoming: { title: 'No trips booked yet', body: 'Rooms near BTS and MRT stations, by the night or the month. Your next stay shows up here.' },
  past: { title: 'No past trips', body: 'Stays you’ve completed appear here, with their receipts.' },
  cancelled: { title: 'Nothing cancelled', body: 'Cancelled, declined and expired bookings appear here.' },
};

/** Owner: Bookings & Payments module. Trips (design B1): Upcoming / Past / Cancelled, tab in the URL. */
export function TripsView() {
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TABS).withDefault('upcoming').withOptions({ history: 'replace' }));
  // All three lists load together so the tab counts are right and switching tabs is instant.
  const lists = { upcoming: useMyBookings('upcoming'), past: useMyBookings('past'), cancelled: useMyBookings('cancelled') };
  const now = useNow(1000);

  return (
    <main className="mx-auto box-border flex max-w-[1040px] flex-col gap-6 px-4 pt-8 pb-14 sm:px-10">
      <PageTitle>Trips</PageTitle>
      <Tabs
        value={tab}
        onValueChange={(v) => void setTab(v as TripsTab)}
        items={TABS.map((t) => ({ value: t, label: LABELS[t], count: lists[t].data?.length }))}
      >
        {TABS.map((t) => {
          const q = lists[t];
          return (
            <TabsContent key={t} value={t} className="mt-6 flex flex-col gap-4 focus:outline-none">
              {q.isLoading ? (
                <>
                  <Skeleton className="h-40 rounded-panel" />
                  <Skeleton className="h-40 rounded-panel" />
                </>
              ) : q.isError ? (
                <EmptyState title="We couldn’t load your trips" action={<Button onClick={() => void q.refetch()}>Try again</Button>}>
                  {errorMessage(q.error)}
                </EmptyState>
              ) : q.data && q.data.length > 0 ? (
                q.data.map((b) => <TripCard key={b.id} booking={b} now={now} />)
              ) : (
                <EmptyState
                  title={EMPTY[t].title}
                  action={
                    t === 'upcoming' ? (
                      <Button asChild>
                        <Link href="/">Explore rooms</Link>
                      </Button>
                    ) : undefined
                  }
                >
                  {EMPTY[t].body}
                </EmptyState>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
      <p className="m-0 text-sm text-muted">
        Can’t find a booking? It may be under a different email. <Link href="/account">Check your account</Link>.
      </p>
    </main>
  );
}
