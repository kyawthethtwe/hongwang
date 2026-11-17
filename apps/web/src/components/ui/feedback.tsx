import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Status pill. Tones map to the design's badges:
 *   brand = Confirmed / Paid, warn = Payment hold / Requested, danger = Cancelled,
 *   info = Scheduled, neutral = Draft / Completed, dark = "Hosting"
 */
export const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-subtle text-ink-2',
      brand: 'bg-brand-soft text-brand-hover',
      warn: 'bg-warn-bg text-warn-ink',
      danger: 'bg-danger-bg text-danger-ink',
      info: 'bg-info-bg text-info-ink',
      dark: 'bg-ink text-white',
      white: 'bg-surface text-ink',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ tone, className, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const bannerTone = {
  warn: { box: 'bg-warn-bg border-warn-line text-[#4A3000]', icon: Clock, iconClass: 'text-warn-icon' },
  danger: { box: 'bg-danger-bg border-danger-line text-danger-ink', icon: AlertTriangle, iconClass: 'text-danger-ink' },
  success: { box: 'bg-brand-soft border-brand-line text-brand-ink', icon: CheckCircle2, iconClass: 'text-brand-hover' },
  info: { box: 'bg-info-bg border-[#c5cce0] text-info-ink', icon: Info, iconClass: 'text-info-ink' },
} as const;

/**
 * Full-width notice ("Dec 12 – 15 is held for you", "This hold has expired", "Payment received").
 * Uses role=alert for danger, role=status otherwise.
 */
export function Banner({
  tone,
  title,
  children,
  action,
  icon = true,
  className,
}: {
  tone: keyof typeof bannerTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  icon?: boolean;
  className?: string;
}) {
  const t = bannerTone[tone];
  const Icon = t.icon;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex flex-wrap items-center gap-3.5 rounded-card border px-5 py-4', t.box, className)}
    >
      {icon && <Icon aria-hidden className={cn('size-[22px] shrink-0', t.iconClass)} />}
      <p className="m-0 min-w-0 flex-[1_1_320px]">
        {title && <strong className="font-semibold">{title} </strong>}
        {children}
      </p>
      {action}
    </div>
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-field bg-line-soft', className)} {...props} />;
}

export function EmptyState({
  title,
  children,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-panel border border-dashed border-line-strong px-6 py-14 text-center', className)}>
      {icon && <div className="text-muted">{icon}</div>}
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      {children && <p className="m-0 max-w-md text-muted">{children}</p>}
      {action}
    </div>
  );
}
