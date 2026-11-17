'use client';

import { X } from 'lucide-react';
import { Dialog as D, DropdownMenu as M, Tabs as T } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Modal dialog (cancel booking, cancel reservation, all photos).
 *   <Dialog open={open} onOpenChange={setOpen} title="Cancel this booking?" description="...">
 *     ...body...
 *     <DialogFooter>...</DialogFooter>
 *   </Dialog>
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  trigger?: React.ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in" />
        <D.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-sheet bg-surface p-6 shadow-float focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <D.Title className="m-0 text-xl font-semibold">{title}</D.Title>
              {description ? (
                <D.Description className="m-0 text-ink-2">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</D.Description>
              )}
            </div>
            <D.Close
              aria-label="Close"
              className="-mt-2 -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-subtle"
            >
              <X className="size-5" aria-hidden />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-2 flex flex-wrap justify-end gap-2.5', className)} {...props} />;
}

export const DialogClose = D.Close;

/** Underline tabs (Trips: Upcoming / Past / Cancelled, Earnings: Upcoming / Paid). */
export function Tabs({
  value,
  onValueChange,
  items,
  className,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  items: { value: string; label: React.ReactNode; count?: number }[];
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <T.Root value={value} onValueChange={onValueChange} className={className}>
      <T.List className="flex flex-wrap gap-1 border-b border-line">
        {items.map((it) => (
          <T.Trigger
            key={it.value}
            value={it.value}
            className="-mb-px inline-flex min-h-12 cursor-pointer items-center gap-2 border-b-[3px] border-transparent bg-transparent px-4 font-semibold text-muted data-[state=active]:border-ink data-[state=active]:text-ink"
          >
            {it.label}
            {it.count !== undefined && (
              <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-ink-2">{it.count}</span>
            )}
          </T.Trigger>
        ))}
      </T.List>
      {children}
    </T.Root>
  );
}
export const TabsContent = T.Content;

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export function DropdownMenuContent({ className, ...props }: React.ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={8}
        align="end"
        className={cn('z-50 min-w-52 rounded-button border border-line bg-surface p-1.5 shadow-float', className)}
        {...props}
      />
    </M.Portal>
  );
}
export function DropdownMenuItem({ className, ...props }: React.ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2 rounded-[8px] px-3 text-[15px] text-ink outline-none data-[highlighted]:bg-subtle',
        className,
      )}
      {...props}
    />
  );
}
export const DropdownMenuSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
