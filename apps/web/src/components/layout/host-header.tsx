'use client';

import Link from 'next/link';
import { useSession } from '@/lib/auth/session';
import { useHostDashboard } from '@/lib/queries/host';
import { Logo } from './logo';
import { NavLink } from './nav-link';
import { UserMenu } from './user-menu';

/**
 * Host header (design C2-C7): logo + "Hosting", Today / Calendar / Listings / Earnings.
 * "Today" carries the number of requests waiting (from GET /host/dashboard, shared with the page).
 */
export function HostHeader({ pendingCount }: { pendingCount?: number }) {
  const { user } = useSession();
  const dashboard = useHostDashboard({ enabled: !!user && pendingCount === undefined });
  const waiting = pendingCount ?? dashboard.data?.pendingRequests.length;
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3 sm:px-10">
      <div className="flex flex-wrap items-center gap-7">
        <Logo href="/host" hosting />
        <nav aria-label="Hosting" className="flex flex-wrap gap-1">
          <NavLink href="/host" exact badge={waiting}>Today</NavLink>
          <NavLink href="/host/calendar">Calendar</NavLink>
          <NavLink href="/host/listings">Listings</NavLink>
          <NavLink href="/host/earnings">Earnings</NavLink>
        </nav>
      </div>
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-full px-3.5 font-medium text-ink no-underline hover:bg-subtle hover:text-ink"
        >
          Switch to travelling
        </Link>
        <UserMenu mode="host" />
      </div>
    </header>
  );
}
