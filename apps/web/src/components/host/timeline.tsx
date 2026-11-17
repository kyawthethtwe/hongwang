'use client';

import type { HostTimelineRow } from '@hongwang/shared';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { DAY_STATE_CLASS, DAY_STATE_LABEL } from './day-state';

/** "Next two weeks": one row per listing, 14 day columns (design C2). Scrolls sideways on phones. */
export function Timeline({ rows }: { rows: HostTimelineRow[] }) {
  const days = rows[0]?.days ?? [];
  if (!days.length) return null;
  return (
    <div className="overflow-x-auto">
      <div
        role="table"
        aria-label="Next two weeks by listing"
        className="grid min-w-[880px] grid-cols-[210px_repeat(14,minmax(44px,1fr))] items-center gap-1"
      >
        <div role="row" className="contents">
          <span role="columnheader" className="sr-only">
            Listing
          </span>
          {days.map((d, i) => (
            <span
              role="columnheader"
              key={d.date}
              className={cn('text-center text-xs leading-[1.3]', i === 0 ? 'font-bold text-ink' : 'font-medium text-muted')}
            >
              {format(parseISO(d.date), 'EEE')}
              <br />
              {format(parseISO(d.date), 'd')}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div role="row" key={row.listingId} className="contents">
            <span role="rowheader" className="pr-2 text-sm leading-[1.3] font-semibold">
              {row.title}
            </span>
            {row.days.map((d) => {
              const label = `${format(parseISO(d.date), 'EEE, MMM d')}: ${DAY_STATE_LABEL[d.state]}${d.guestName ? `, ${d.guestName}` : ''}`;
              const cls = cn('block h-10 rounded-[8px]', DAY_STATE_CLASS[d.state]);
              return (
                <span role="cell" key={d.date}>
                  {d.bookingId ? (
                    <Link href={`/host/reservations/${d.bookingId}`} aria-label={label} title={label} className={cn(cls, 'hover:opacity-85')} />
                  ) : (
                    <span className={cls} title={label}>
                      <span className="sr-only">{label}</span>
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
