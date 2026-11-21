'use client';

import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from 'input-otp';
import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * The phone code boxes (design A4), built on input-otp. It is one real <input>, drawn as `length`
 * boxes, so paste, SMS autofill (autocomplete="one-time-code"), password managers and screen
 * readers all see a single labelled field. `value` is the digits typed so far.
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
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {legend}
      </label>
      <OTPInput
        id={id}
        value={value}
        onChange={onChange}
        maxLength={length}
        pattern={REGEXP_ONLY_DIGITS}
        // Pasting "495 595" or the whole SMS ("Your Hongwang code is 495595…") keeps just the code.
        pasteTransformer={(text) => text.replace(/\D/g, '').slice(0, length)}
        inputMode="numeric"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy || undefined}
        containerClassName="disabled:cursor-not-allowed"
        render={({ slots }) => (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
            {slots.map((slot, i) => (
              <Slot key={i} {...slot} invalid={invalid} disabled={disabled} />
            ))}
          </div>
        )}
      />
    </div>
  );
}

function Slot({ char, isActive, hasFakeCaret, invalid, disabled }: SlotProps & { invalid?: boolean; disabled?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative flex min-h-14 min-w-0 items-center justify-center rounded-field border border-line-strong bg-surface text-[22px] font-semibold text-ink transition-colors',
        isActive ? 'border-2 border-brand' : invalid && 'border-danger',
        disabled && 'bg-canvas',
      )}
    >
      {char}
      {hasFakeCaret && <span className="pointer-events-none absolute h-6 w-px animate-pulse bg-ink motion-reduce:animate-none" />}
    </div>
  );
}
