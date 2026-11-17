'use client';

import type { HostCalendarDay, IsoDate } from '@hongwang/shared';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { formatTHB } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DAY_STATE_CLASS } from '../day-state';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Open or blocked, and not in the past: the nights a host can select. */
export const isSelectable = (d: HostCalendarDay) => !d.isPast && (d.state === 'open' || d.state === 'blocked');

function ariaFor(d: HostCalendarDay) {
  const day = format(parseISO(d.date), 'MMMM d');
  switch (d.state) {
    case 'booked':
      return `${day}: booked by ${d.guestName ?? 'a guest'}`;
    case 'payment_hold':
      return `${day}: payment hold for ${d.guestName ?? 'a guest'}`;
    case 'requested':
      return `${day}: requested by ${d.guestName ?? 'a guest'}`;
    case 'blocked':
      return `${day}, blocked${d.isPast ? ', past' : ''}`;
    default:
      return `${day}, open at ${formatTHB(d.price)}${d.isSpecialPrice ? ' (special price)' : ''}${d.isPast ? ', past' : ''}`;
  }
}

/**
 * Month grid (design C5). Open/blocked nights are buttons: click to toggle, drag across days to
 * select a range, Enter/Space from the keyboard. Booking nights link to the reservation.
 */
export function MonthGrid({
  days,
  today,
  selected,
  onSelectedChange,
}: {
  days: HostCalendarDay[];
  today: IsoDate;
  selected: ReadonlySet<IsoDate>;
  onSelectedChange: (next: Set<IsoDate>) => void;
}) {
  const drag = useRef<{ anchor: IsoDate; base: Set<IsoDate>; adding: boolean } | null>(null);

  useEffect(() => {
    const end = () => (drag.current = null);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, []);

  function applyRange(to: IsoDate) {
    const d = drag.current;
    if (!d) return;
    const [a, b] = d.anchor <= to ? [d.anchor, to] : [to, d.anchor];
    const next = new Set(d.base);
    for (const day of days) {
      if (day.date < a || day.date > b || !isSelectable(day)) continue;
      if (d.adding) next.add(day.date);
      else next.delete(day.date);
    }
    onSelectedChange(next);
  }

  function toggle(date: IsoDate) {
    const next = new Set(selected);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    onSelectedChange(next);
  }

  const lead = days.length ? parseISO(days[0]!.date).getDay() : 0;

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[620px] grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <span key={w} aria-hidden className="px-2 py-1 text-[13px] font-semibold text-muted">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden />
        ))}
        {days.map((d) => {
          const dayNum = Number(d.date.slice(8));
          const base = 'flex h-[88px] flex-col justify-between rounded-field p-2 text-left box-border';
          if (d.bookingId && (d.state === 'booked' || d.state === 'payment_hold' || d.state === 'requested')) {
            const label = d.isBookingStart ? d.guestName : d.state === 'payment_hold' ? 'Hold' : d.state === 'requested' ? 'Request' : '';
            return (
              <Link
                key={d.date}
                href={`/host/reservations/${d.bookingId}`}
                aria-label={ariaFor(d)}
                className={cn(
                  base,
                  DAY_STATE_CLASS[d.state],
                  'no-underline hover:opacity-90',
                  d.state === 'booked' ? 'hover:text-white' : 'hover:text-ink',
                  d.isPast && 'opacity-55',
                )}
              >
                <span className="text-sm font-semibold">{dayNum}</span>
                <span className="truncate text-xs font-semibold">{label}</span>
              </Link>
            );
          }
          const picked = selected.has(d.date);
          const selectable = isSelectable(d);
          return (
            <button
              key={d.date}
              type="button"
              data-date={d.date}
              aria-label={ariaFor(d)}
              aria-pressed={picked}
              disabled={!selectable}
              onPointerDown={(e) => {
                if (!selectable || e.button !== 0) return;
                e.preventDefault();
                (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
                drag.current = { anchor: d.date, base: new Set(selected), adding: !picked };
                applyRange(d.date);
              }}
              onPointerEnter={() => drag.current && selectable && applyRange(d.date)}
              onClick={(e) => {
                // Pointer clicks were handled on pointerdown; this is Enter/Space.
                if (e.detail === 0 && selectable) toggle(d.date);
              }}
              className={cn(
                base,
                'cursor-pointer touch-manipulation select-none',
                d.state === 'blocked'
                  ? DAY_STATE_CLASS.blocked
                  : picked
                    ? 'bg-subtle'
                    : 'bg-surface',
                picked
                  ? 'border-2 border-ink'
                  : d.date === today
                    ? 'border-2 border-brand'
                    : d.state === 'blocked'
                      ? 'border border-transparent'
                      : 'border border-line-card',
                d.isPast && 'cursor-default opacity-45',
              )}
            >
              <span className="text-sm font-semibold">{dayNum}</span>
              <span className={cn('text-[13px]', d.isSpecialPrice ? 'font-bold' : 'font-medium')}>
                {d.isPast ? '' : d.state === 'blocked' ? 'Blocked' : formatTHB(d.price)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
