'use client';

import { todayInBangkok, type IsoDate } from '@hongwang/shared';
import { useQueryStates } from 'nuqs';
import { useMemo, useState } from 'react';
import { addMonthsIso, formatStayLong, monthStartIso } from '@/components/search/dates';
import { fromIso, RangeCalendar, toIso } from '@/components/search/range-calendar';
import { rangeHasUnavailable } from '@/components/search/range';
import { stayOf, stayParsers } from '@/components/search/search-params';
import { Button } from '@/components/ui/button';
import { formatDay, pluralize } from '@/lib/format';
import { useAvailability } from '@/lib/queries/listings';

/**
 * Availability calendar (design A2): two months, unavailable nights struck through. Picking a range
 * writes ?checkIn&checkOut, which the reserve card reads.
 */
export function ListingAvailability({
  listingId,
  area,
  minNights,
  maxNights,
  bookingWindowMonths,
}: {
  listingId: string;
  area: string;
  minNights: number;
  maxNights: number;
  bookingWindowMonths: number;
}) {
  const [range, setRange] = useQueryStates(stayParsers, { history: 'replace', scroll: false });
  const today = todayInBangkok();
  const lastDay = addMonthsIso(today, bookingWindowMonths);
  const [month, setMonth] = useState(() => fromIso(monthStartIso(range.checkIn && range.checkIn >= today ? range.checkIn : today)));
  const from = toIso(month);
  const to = addMonthsIso(from, 2);
  const { data, isError } = useAvailability(listingId, from, to);
  const unavailable = useMemo(() => new Set<IsoDate>(data?.unavailable ?? []), [data]);
  const stay = stayOf(range);
  const clash = stay && data ? rangeHasUnavailable(range, (d) => unavailable.has(d)) : false;
  const tooShort = stay && stay.nights < minNights;
  const tooLong = stay && stay.nights > maxNights;

  return (
    <section aria-labelledby="availability-title" className="border-b border-line py-7">
      <h2 id="availability-title" className="m-0 text-xl font-semibold">
        {stay ? `${pluralize(stay.nights, 'night')} in ${area}` : 'Select your dates'}
      </h2>
      <p className="m-0 mt-0.5 mb-[18px] text-muted">
        {stay
          ? formatStayLong(stay.checkIn, stay.checkOut, formatDay)
          : range.checkIn
            ? `Check-in ${formatDay(range.checkIn)}. Now pick your check-out date.`
            : minNights > 1
              ? `Minimum stay is ${pluralize(minNights, 'night')}.`
              : 'Add your travel dates for exact pricing.'}
      </p>
      <div className="max-w-[880px]">
        <RangeCalendar
          value={{ checkIn: range.checkIn, checkOut: range.checkOut }}
          onChange={(r) => void setRange({ checkIn: r.checkIn, checkOut: r.checkOut })}
          unavailable={unavailable}
          minDate={today}
          maxDate={lastDay}
          month={month}
          onMonthChange={setMonth}
        />
        <div className="mt-3.5 flex flex-wrap items-center gap-[18px] text-[13px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="size-3.5 rounded-[4px] bg-brand" />
            Your dates
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="font-medium text-placeholder line-through">18</span>
            Unavailable
          </span>
          {(range.checkIn || range.checkOut) && (
            <Button variant="link" size="sm" className="min-h-11" onClick={() => void setRange({ checkIn: null, checkOut: null })}>
              Clear dates
            </Button>
          )}
        </div>
        <div role="status" className="mt-2 text-sm">
          {isError && <p className="m-0 text-danger-ink">We couldn’t load availability. Dates are checked again when you reserve.</p>}
          {clash && <p className="m-0 text-danger-ink">Some of these nights are already taken. Pick other dates.</p>}
          {!clash && tooShort && <p className="m-0 text-warn-ink">This place needs at least {pluralize(minNights, 'night')}.</p>}
          {!clash && tooLong && <p className="m-0 text-warn-ink">This place takes stays of up to {pluralize(maxNights, 'night')}.</p>}
        </div>
      </div>
    </section>
  );
}
