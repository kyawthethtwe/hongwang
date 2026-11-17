import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepState = 'done' | 'current' | 'later';

/** "Dates chosen ✓ → Pay within 15 min → Booking confirmed" (design A3). */
export function ProgressSteps({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ol aria-label="Booking progress" className="m-0 mb-6 flex list-none flex-wrap items-center gap-3 p-0">
      {steps.map((s, i) => (
        <li key={s.label} aria-current={s.state === 'current' ? 'step' : undefined} className="flex items-center gap-3">
          <span className="flex items-center gap-2.5">
            <span
              className={cn(
                'box-border flex size-[30px] items-center justify-center rounded-full border-2 text-[13px] font-bold',
                s.state === 'done' && 'border-brand bg-brand text-white',
                s.state === 'current' && 'border-brand bg-surface text-brand',
                s.state === 'later' && 'border-line-strong bg-surface text-muted',
              )}
            >
              {s.state === 'done' ? <Check aria-hidden className="size-4" strokeWidth={3} /> : i + 1}
              {s.state === 'done' && <span className="sr-only">Done:</span>}
            </span>
            <span className={cn(s.state === 'current' ? 'font-semibold' : 'font-medium', s.state === 'later' ? 'text-muted' : 'text-ink')}>
              {s.label}
            </span>
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden className={cn('h-0.5 w-12', s.state === 'done' ? 'bg-brand' : 'bg-line-strong')} />
          )}
        </li>
      ))}
    </ol>
  );
}
