'use client';

import { todayInBangkok, type IsoDate } from '@hongwang/shared';
import { format, parseISO } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { parseAsString, useQueryState } from 'nuqs';
import { useEffect, useMemo, useState } from 'react';
import { formatTHB, pluralize } from '@/lib/format';
import { useHostCalendar, useMyListings } from '@/lib/queries/host';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Label, Select } from '@/components/ui/field';
import { PageTitle } from '@/components/ui/surfaces';
import { CreateListingButton } from '../create-listing-button';
import { DayStateLegend } from '../day-state';
import { QueryError } from '../query-state';
import { MonthGrid } from './month-grid';
import { SelectionPanel } from './selection-panel';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Host calendar: block dates, set special prices (design C5). ?listingId=&month= in the URL. */
export function CalendarView() {
  const today = todayInBangkok();
  const thisMonth = today.slice(0, 7);
  const listings = useMyListings();
  const [listingParam, setListingParam] = useQueryState('listingId');
  const [monthParam, setMonthParam] = useQueryState('month', parseAsString.withDefault(thisMonth));
  const month = MONTH_RE.test(monthParam) ? monthParam : thisMonth;
  const listingId = listingParam ?? listings.data?.[0]?.id ?? null;

  // Put the default listing in the URL so the page can be shared and reloaded.
  useEffect(() => {
    if (!listingParam && listings.data?.[0]) void setListingParam(listings.data[0].id, { history: 'replace' });
  }, [listingParam, listings.data, setListingParam]);

  const calendar = useHostCalendar(listingId, month);
  const [selected, setSelected] = useState<Set<IsoDate>>(new Set());
  useEffect(() => setSelected(new Set()), [listingId, month]);

  const selectedDays = useMemo(
    () => (calendar.data?.days ?? []).filter((d) => selected.has(d.date)),
    [calendar.data, selected],
  );

  if (listings.isLoading) return <Skeleton className="h-[600px] w-full rounded-panel" />;
  if (listings.error) return <QueryError error={listings.error} retry={() => void listings.refetch()} what="your calendar" />;
  if (!listings.data?.length) {
    return (
      <div className="flex flex-col gap-5">
        <PageTitle>Calendar</PageTitle>
        <EmptyState
          icon={<CalendarDays aria-hidden className="size-8" />}
          title="No listings yet"
          action={<CreateListingButton>Create a listing</CreateListingButton>}
        >
          Your calendar shows bookings, blocked nights and prices once you have a listing.
        </EmptyState>
      </div>
    );
  }

  const monthLabel = format(parseISO(`${month}-01`), 'MMMM yyyy');
  const cal = calendar.data;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <PageTitle>Calendar</PageTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <Label htmlFor="calendar-listing" className="text-ink-2">
              Listing
            </Label>
            <Select
              id="calendar-listing"
              className="min-h-11 w-auto max-w-full font-medium"
              value={listingId ?? ''}
              onChange={(e) => void setListingParam(e.target.value)}
            >
              {listings.data.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title || 'Untitled listing'}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-field" aria-label="Previous month" onClick={() => void setMonthParam(shiftMonth(month, -1))}>
            <ChevronLeft aria-hidden className="size-5" />
          </Button>
          <span aria-live="polite" className="min-w-[150px] text-center text-[17px] font-semibold">
            {monthLabel}
          </span>
          <Button variant="outline" size="icon" className="rounded-field" aria-label="Next month" onClick={() => void setMonthParam(shiftMonth(month, 1))}>
            <ChevronRight aria-hidden className="size-5" />
          </Button>
        </div>
      </div>

      {calendar.error ? (
        <QueryError error={calendar.error} retry={() => void calendar.refetch()} what="this listing’s calendar" />
      ) : (
        <div className="flex flex-wrap items-start gap-6">
          <section
            aria-label={monthLabel}
            aria-busy={calendar.isFetching}
            className="min-w-0 flex-[999_1_640px] rounded-panel border border-line bg-surface p-4"
          >
            {cal ? (
              <MonthGrid days={cal.days} today={today} selected={selected} onSelectedChange={setSelected} />
            ) : (
              <Skeleton className="h-[520px] w-full" />
            )}
            <DayStateLegend
              className="mt-3.5"
              labels={{ booked: 'Booked', blocked: 'Blocked', open: 'Open, nightly price shown' }}
            />
          </section>

          <aside
            aria-label="Edit dates"
            className="box-border flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-panel border border-line bg-surface p-5"
          >
            {cal && selectedDays.length > 0 ? (
              <SelectionPanel
                key={selectedDays.map((d) => `${d.date}:${d.state}:${d.price}`).join(',')}
                calendar={cal}
                days={selectedDays}
                onDone={() => setSelected(new Set())}
              />
            ) : (
              <>
                <h2 className="m-0 text-lg font-semibold">Pricing and settings</h2>
                {cal ? (
                  <dl className="m-0 flex flex-col gap-2.5">
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-2">Base price</dt>
                      <dd className="m-0 font-semibold">{formatTHB(cal.listing.basePrice)} a night</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-2">Cleaning fee</dt>
                      <dd className="m-0 font-semibold">{formatTHB(cal.listing.cleaningFee)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-2">Minimum stay</dt>
                      <dd className="m-0 font-semibold">{pluralize(cal.listing.minNights, 'night')}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-2">Booking type</dt>
                      <dd className="m-0 font-semibold">{cal.listing.instantBook ? 'Instant book' : 'Request to book'}</dd>
                    </div>
                  </dl>
                ) : (
                  <Skeleton className="h-32 w-full" />
                )}
                {listingId && (
                  <Button asChild variant="outline-dark">
                    <Link href={`/host/listings/${listingId}/edit?section=pricing`}>Edit pricing</Link>
                  </Button>
                )}
                <p className="m-0 text-sm text-muted">
                  Select open or blocked nights to block them or set a special price. Drag across days to select a
                  range. Tap a booking to open it.
                </p>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
