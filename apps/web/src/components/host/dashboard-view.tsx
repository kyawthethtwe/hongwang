'use client';

import { daysBetween, todayInBangkok, type BookingDto, type HostDashboardDto } from '@hongwang/shared';
import { format, parseISO } from 'date-fns';
import { Home } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useHostDashboard } from '@/lib/queries/host';
import { formatDay, formatTHB, pluralize } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { PageTitle, SectionTitle, Stat } from '@/components/ui/surfaces';
import { CreateListingButton } from './create-listing-button';
import { DayStateLegend } from './day-state';
import { PageSkeleton, QueryError } from './query-state';
import { overlappingRequests, RequestCard } from './request-card';
import type { RequestOutcome } from './request-actions';
import { Timeline } from './timeline';
import { UpcomingTable } from './upcoming-table';
import { leftUntil, useNow } from './use-now';

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Bangkok' }).format(now));
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function arrivalWord(today: string, checkIn: string) {
  const d = daysBetween(today, checkIn);
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `on ${format(parseISO(checkIn), 'EEE')}`;
}

function summaryLine(d: HostDashboardDto, today: string) {
  const n = d.pendingRequests.length;
  const parts = [format(parseISO(today), 'EEEE, MMMM d'), n === 0 ? 'No requests waiting' : `${pluralize(n, 'request')} waiting`];
  const next = d.arrivingSoon.bookings[0];
  if (next) parts.push(`${next.guest.firstName} arrives ${arrivalWord(today, next.checkIn)}`);
  return parts.join(' · ');
}

function arrivingSub(bookings: BookingDto[], today: string) {
  if (!bookings.length) return 'No check-ins this week';
  const list = bookings
    .slice(0, 3)
    .map((b) => {
      const d = daysBetween(today, b.checkIn);
      const when = d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `on ${format(parseISO(b.checkIn), 'EEE')}`;
      return `${b.guest.firstName} ${when}${b.status === 'payment_hold' ? ' if they pay' : ''}`;
    })
    .join(', ');
  return bookings.length > 3 ? `${list} and ${bookings.length - 3} more` : list;
}

/** Host "Today" (design C2). */
export function DashboardView() {
  const { data, error, isLoading, refetch } = useHostDashboard();
  const now = useNow();
  // Requests answered on this page stay visible with their result until the next visit.
  const [answered, setAnswered] = useState<Record<string, { dto: BookingDto; outcome: RequestOutcome }>>({});

  if (isLoading) return <PageSkeleton rows={4} />;
  if (error || !data) return <QueryError error={error} retry={() => void refetch()} what="your hosting dashboard" />;

  const today = todayInBangkok(new Date(now));
  const title = `${greeting(new Date(now))}, ${data.greetingName}`;

  if (data.listingCount === 0) {
    return (
      <div className="flex flex-col gap-7">
        <div>
          <PageTitle>{title}</PageTitle>
          <p className="m-0 mt-1 text-ink-2">{format(parseISO(today), 'EEEE, MMMM d')}</p>
        </div>
        <EmptyState
          icon={<Home aria-hidden className="size-8" />}
          title="Create your first listing"
          action={<CreateListingButton requireOnboarding>Create your first listing</CreateListingButton>}
        >
          Draft a room in a few minutes. Requests, payouts and your calendar show up here once guests start booking.
        </EmptyState>
      </div>
    );
  }

  const pendingIds = new Set(data.pendingRequests.map((b) => b.id));
  const requests = [
    ...data.pendingRequests.map((b) => ({ dto: b, outcome: answered[b.id]?.outcome })),
    ...Object.values(answered).filter((a) => !pendingIds.has(a.dto.id)),
  ].sort((a, b) => (a.dto.requestExpiresAt ?? '').localeCompare(b.dto.requestExpiresAt ?? ''));
  const stillPending = data.pendingRequests.filter((b) => !answered[b.id]);
  const monthName = format(parseISO(today), 'MMMM');

  return (
    <div className="flex flex-col gap-7">
      <div>
        <PageTitle>{title}</PageTitle>
        <p className="m-0 mt-1 text-ink-2">{summaryLine({ ...data, pendingRequests: stillPending }, today)}</p>
      </div>

      <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <Stat
          label="Requests waiting"
          value={stillPending.length}
          sub={
            data.oldestRequestExpiresAt && stillPending.length
              ? `Oldest expires in ${leftUntil(data.oldestRequestExpiresAt, now)}`
              : 'Nothing to answer right now'
          }
        />
        <Stat
          label="Arriving in the next 7 days"
          value={data.arrivingSoon.count}
          sub={arrivingSub(data.arrivingSoon.bookings, today)}
        />
        <Stat
          label="Next payout"
          value={data.nextPayout ? formatTHB(data.nextPayout.amount) : '—'}
          sub={
            data.nextPayout
              ? `${formatDay(data.nextPayout.date)}, 24 h after ${data.nextPayout.guestName} checks in`
              : 'No confirmed stays coming up'
          }
        />
        <Stat
          label={`${monthName} so far`}
          value={formatTHB(data.monthToDate.amount)}
          sub={`${pluralize(data.monthToDate.confirmedCount, 'confirmed stay')}, ${data.monthToDate.onHoldCount} on payment hold`}
        />
      </section>

      <section aria-labelledby="requests-title" className="flex flex-col gap-3.5">
        <SectionTitle id="requests-title">Requests to respond to</SectionTitle>
        {requests.length === 0 ? (
          <p className="m-0 rounded-panel border border-dashed border-line-strong bg-surface px-5 py-6 text-muted">
            No requests waiting. New requests show up here, and you have 24 hours to answer each one.
          </p>
        ) : (
          requests.map(({ dto, outcome }) => (
            <RequestCard
              key={dto.id}
              booking={dto}
              outcome={outcome}
              others={overlappingRequests(dto, stillPending)}
              onDone={(o, updated) => setAnswered((prev) => ({ ...prev, [dto.id]: { dto: { ...dto, status: updated.status }, outcome: o } }))}
            />
          ))
        )}
      </section>

      <section
        aria-labelledby="timeline-title"
        className="flex flex-col gap-4 rounded-panel border border-line bg-surface px-[22px] py-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle id="timeline-title">Next two weeks</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="font-medium">
              <Link href="/host/calendar">Block dates</Link>
            </Button>
            <Button asChild variant="outline" className="font-medium">
              <Link href="/host/calendar">Edit prices</Link>
            </Button>
          </div>
        </div>
        <Timeline rows={data.timeline} />
        <DayStateLegend />
      </section>

      <section
        aria-labelledby="upcoming-title"
        className="flex flex-col gap-3 rounded-panel border border-line bg-surface px-[22px] py-5"
      >
        <SectionTitle id="upcoming-title">Upcoming stays</SectionTitle>
        {data.upcoming.length ? (
          <UpcomingTable bookings={data.upcoming} />
        ) : (
          <p className="m-0 text-muted">No upcoming stays yet.</p>
        )}
        <p className="m-0 text-[13px] text-muted">
          Payouts release 24 hours after check-in. Guest phone numbers unlock once a stay is confirmed.
        </p>
      </section>
    </div>
  );
}
