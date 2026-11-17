'use client';

import { Minus, Plus } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Number stepper with − / + buttons (guests, beds, bathrooms).
 *   <Stepper label="Guests" value={n} onChange={setN} min={1} max={16} />
 */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  error,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  className?: string;
}) {
  const id = React.useId();
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step));
  const safe = Number.isFinite(value) ? value : min;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={`${id}-label`} className="text-sm font-semibold text-ink">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        className={cn(
          'flex min-h-12 items-center justify-between gap-2 rounded-field border border-line-strong bg-surface px-1',
          error && 'border-danger',
        )}
      >
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={safe <= min}
          onClick={() => onChange(clamp(safe - step))}
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:text-disabled disabled:hover:bg-transparent"
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <output aria-live="polite" className="min-w-8 text-center font-semibold font-tabular">
          {safe}
        </output>
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={safe >= max}
          onClick={() => onChange(clamp(safe + step))}
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:text-disabled disabled:hover:bg-transparent"
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
      {error && (
        <p className="m-0 text-[13px] font-medium text-danger-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
