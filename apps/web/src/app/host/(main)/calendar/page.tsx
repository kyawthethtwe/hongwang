import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CalendarView } from '@/components/host/calendar/calendar-view';
import { Skeleton } from '@/components/ui/feedback';

export const metadata: Metadata = { title: 'Calendar' };

/** Host calendar: block dates, set prices (design C5). */
export default function HostCalendarPage() {
  return (
    <main className="mx-auto box-border w-full max-w-[1280px] px-4 pt-7 pb-14 sm:px-10">
      <Suspense fallback={<Skeleton className="h-[600px] w-full rounded-panel" />}>
        <CalendarView />
      </Suspense>
    </main>
  );
}
