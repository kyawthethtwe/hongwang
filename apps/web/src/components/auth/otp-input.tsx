'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Six one-digit boxes for the phone code (design A4). Typing moves forward, Backspace moves back,
 * pasting or SMS autofill ("one-time-code") fills every box. `value` is the digits typed so far.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  invalid,
  describedBy,
  autoFocus,
  disabled,
  legend = `${length}-digit code`,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  legend?: string;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  /** Writes `incoming` digits starting at box `i` and moves focus after them. */
  const fill = (i: number, incoming: string) => {
    const clean = incoming.replace(/\D/g, '');
    if (!clean) return;
    const next = digits.slice();
    for (let k = 0; k < clean.length && i + k < length; k++) next[i + k] = clean[k]!;
    const joined = next.join('').slice(0, length);
    onChange(joined);
    focus(Math.min(joined.length, length - 1));
  };

  return (
    <fieldset className="m-0 border-0 p-0" aria-describedby={describedBy}>
      <legend className="mb-2 p-0 text-sm font-semibold">{legend}</legend>
      <div className="grid grid-cols-6 gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid || undefined}
            autoFocus={autoFocus && i === 0}
            disabled={disabled}
            value={d}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const raw = e.currentTarget.value.replace(/\D/g, '');
              if (!raw) {
                onChange((digits.slice(0, i).join('') + digits.slice(i + 1).join('')).slice(0, length));
                return;
              }
              // Typing over a filled box: keep only the new digit.
              const incoming = d && raw.length === 2 ? (raw[0] === d ? raw[1]! : raw[0]!) : raw;
              fill(i, incoming);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !d && i > 0) {
                e.preventDefault();
                onChange(digits.slice(0, i - 1).join(''));
                focus(i - 1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                focus(i - 1);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                focus(i + 1);
              }
            }}
            onPaste={(e) => {
              e.preventDefault();
              fill(i, e.clipboardData.getData('text'));
            }}
            className={cn(
              'min-h-14 w-full min-w-0 rounded-field border border-line-strong bg-surface text-center text-[22px] font-semibold text-ink transition-colors',
              'focus:border-2 focus:border-brand focus:outline-none disabled:bg-canvas',
              invalid && 'border-danger',
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}
