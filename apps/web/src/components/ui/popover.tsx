'use client';

import { Popover as P } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Popover panel (search dates, guests, price filter).
 *   <Popover open={open} onOpenChange={setOpen}>
 *     <PopoverTrigger asChild><Chip pressed={false}>Price</Chip></PopoverTrigger>
 *     <PopoverContent aria-label="Price per night">...</PopoverContent>
 *   </Popover>
 */
export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

export function PopoverContent({ className, align = 'start', sideOffset = 8, ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={16}
        className={cn(
          'z-50 max-w-[calc(100vw-32px)] rounded-card border border-line bg-surface p-4 text-ink shadow-float focus:outline-none',
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}
