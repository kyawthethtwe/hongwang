'use client';

import { Switch as S } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * On/off switch (instant book). Label it with a wrapping <label> or aria-labelledby.
 *   <Switch checked={on} onCheckedChange={setOn} aria-label="Instant book" />
 */
export const Switch = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof S.Root>>(
  ({ className, ...props }, ref) => (
    <S.Root
      ref={ref}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-line-strong transition-colors disabled:cursor-not-allowed disabled:opacity-55 data-[state=checked]:bg-brand',
        className,
      )}
      {...props}
    >
      <S.Thumb className="block size-6 rounded-full bg-surface shadow-pop transition-transform data-[state=checked]:translate-x-5" />
    </S.Root>
  ),
);
Switch.displayName = 'Switch';
