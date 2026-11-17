import type { CalendarDayState } from '@hongwang/shared';
import { cn } from '@/lib/utils';

/** Cell look per night state (design C2 timeline, C5 calendar). */
export const DAY_STATE_CLASS: Record<CalendarDayState, string> = {
  open: 'bg-surface border border-line-card text-ink',
  booked: 'bg-brand text-white',
  payment_hold: 'bg-hold text-hold-ink',
  requested: 'bg-surface border-2 border-dashed border-placeholder text-ink',
  blocked:
    'bg-[repeating-linear-gradient(45deg,var(--color-line-strong)_0_3px,var(--color-line-soft)_3px_6px)] text-ink',
};

export const DAY_STATE_LABEL: Record<CalendarDayState, string> = {
  booked: 'Confirmed',
  payment_hold: 'Payment hold',
  requested: 'Requested',
  blocked: 'Blocked by you',
  open: 'Open',
};

const ORDER: CalendarDayState[] = ['booked', 'payment_hold', 'requested', 'blocked', 'open'];

export function DayStateLegend({
  labels = {},
  className,
}: {
  labels?: Partial<Record<CalendarDayState, string>>;
  className?: string;
}) {
  return (
    <ul className={cn('m-0 flex list-none flex-wrap gap-x-[18px] gap-y-2 p-0 text-[13px] text-ink-2', className)}>
      {ORDER.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('size-4 rounded-[4px]', DAY_STATE_CLASS[s], s === 'requested' && 'border-2')} />
          {labels[s] ?? DAY_STATE_LABEL[s]}
        </li>
      ))}
    </ul>
  );
}
