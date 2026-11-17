import type { Metadata } from 'next';
import { DashboardView } from '@/components/host/dashboard-view';

export const metadata: Metadata = { title: 'Today' };

/** Host "Today" dashboard (design C2). */
export default function HostTodayPage() {
  return (
    <main className="mx-auto box-border w-full max-w-[1200px] px-4 pt-8 pb-14 sm:px-10">
      <DashboardView />
    </main>
  );
}
