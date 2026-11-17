'use client';

import type { IsoDate } from '@hongwang/shared';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type Matcher } from 'react-day-picker';
import { nextRange, type DateRange } from './range';

export const toIso = (d: Date): IsoDate => format(d, 'yyyy-MM-dd');
export const fromIso = (d: IsoDate) => parseISO(d);

const dayCell = 'p-0.5 text-center align-middle';
const dayButton =
  'mx-auto flex h-11 w-full min-w-10 cursor-pointer items-center justify-center rounded-field border-0 bg-transparent text-sm text-ink hover:bg-subtle focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:text-disabled disabled:hover:bg-transparent';

/**
 * Range calendar (react-day-picker v9) styled with the design tokens. Used by the search bar and
 * the listing page availability calendar. Selection logic is `nextRange` (check-out may land on
 * an unavailable night; nights in between must be free).
 */
export function RangeCalendar({
  value,
  onChange,
  unavailable,
  minDate,
  maxDate,
  numberOfMonths = 2,
  month,
  onMonthChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  unavailable?: ReadonlySet<IsoDate>;
  minDate: IsoDate;
  maxDate?: IsoDate;
  numberOfMonths?: number;
  month?: Date;
  onMonthChange?: (month: Date) => void;
}) {
  const isUnavailable = (night: IsoDate) => unavailable?.has(night) ?? false;
  const { checkIn, checkOut } = value;
  const disabled: Matcher[] = [{ before: fromIso(minDate) }];
  if (maxDate) disabled.push({ after: fromIso(maxDate) });

  return (
    <DayPicker
      numberOfMonths={numberOfMonths}
      month={month}
      onMonthChange={onMonthChange}
      defaultMonth={checkIn ? fromIso(checkIn) : fromIso(minDate)}
      startMonth={fromIso(minDate)}
      endMonth={maxDate ? fromIso(maxDate) : undefined}
      weekStartsOn={0}
      disabled={disabled}
      modifiers={{
        start: (d) => !!checkIn && toIso(d) === checkIn,
        end: (d) => !!checkOut && toIso(d) === checkOut,
        middle: (d) => !!checkIn && !!checkOut && toIso(d) > checkIn && toIso(d) < checkOut,
        unavailable: (d) => isUnavailable(toIso(d)),
      }}
      modifiersClassNames={{
        start: '[&>button]:bg-brand [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-brand-hover',
        end: '[&>button]:bg-brand [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-brand-hover',
        middle: '[&>button]:rounded-none [&>button]:bg-brand-soft [&>button]:font-medium',
        unavailable: '[&>button]:text-placeholder [&>button]:line-through',
      }}
      onDayClick={(day, modifiers) => {
        if (modifiers.disabled) return;
        const next = nextRange(value, toIso(day), isUnavailable);
        if (next) onChange(next);
      }}
      labels={{
        labelDayButton: (date, m) =>
          [
            format(date, 'EEEE, MMMM d, yyyy'),
            m.start ? 'check-in' : null,
            m.end ? 'check-out' : null,
            m.middle ? 'selected' : null,
            m.unavailable ? 'unavailable' : null,
          ]
            .filter(Boolean)
            .join(', '),
      }}
      classNames={{
        root: 'relative w-full',
        months: 'flex flex-wrap gap-x-8 gap-y-4',
        month: 'min-w-[260px] flex-1',
        month_caption: 'flex h-11 items-center pr-24',
        caption_label: 'text-[15px] font-semibold',
        nav: 'absolute top-0 right-0 z-10 flex gap-1',
        button_previous:
          'inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40',
        button_next:
          'inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-40',
        month_grid: 'w-full border-collapse',
        weekdays: '',
        weekday: 'pb-1 text-xs font-semibold text-muted',
        week: '',
        day: dayCell,
        day_button: dayButton,
        today: '[&>button]:font-semibold',
        outside: 'invisible',
        hidden: 'invisible',
        disabled: '',
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? <ChevronLeft aria-hidden className="size-5" /> : <ChevronRight aria-hidden className="size-5" />,
      }}
    />
  );
}
