import * as React from 'react';
import { cn } from '@/lib/utils';

/** White card with the design's border and radius (host stat tiles, summaries). */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-card border border-line bg-surface p-5', className)} {...props} />;
}

/** Large page title in the display face. */
export function PageTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn('m-0 font-display text-[34px] leading-[1.15] font-bold tracking-[-0.02em]', className)}
      {...props}
    />
  );
}

export function SectionTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('m-0 text-xl font-semibold', className)} {...props} />;
}

/** Stat tile: label, big number, sub line (host dashboard, earnings). */
export function Stat({ label, value, sub, className }: { label: React.ReactNode; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('px-5 py-[18px]', className)}>
      <p className="m-0 text-sm font-medium text-ink-2">{label}</p>
      <p className="m-0 mt-1 font-display text-[32px] leading-[1.1] font-bold">{value}</p>
      {sub && <p className="m-0 mt-1 text-[13px] text-muted">{sub}</p>}
    </Card>
  );
}

/** Initials or photo in a circle. */
export function Avatar({
  name,
  initials,
  src,
  size = 44,
  className,
}: {
  name: string;
  initials?: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const text =
    initials ??
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-semibold text-brand-hover', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <span aria-hidden>{text}</span>
      )}
      {!src && <span className="sr-only">{name}</span>}
    </span>
  );
}

/** Toggle pill used for search filters ("Near BTS/MRT", "Instant book"). */
export function Chip({
  pressed,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'min-h-11 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors',
        pressed ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface text-ink hover:border-ink',
        className,
      )}
      {...props}
    />
  );
}

/** Placeholder block for a missing photo, tinted like the design. */
export function PhotoPlaceholder({ tint = 1, label = 'Room photo', className }: { tint?: 1 | 2 | 3 | 4 | 5 | 6; label?: string; className?: string }) {
  const bg = ['bg-tint-1', 'bg-tint-2', 'bg-tint-3', 'bg-tint-4', 'bg-tint-5', 'bg-tint-6'][tint - 1];
  return (
    <div className={cn('flex items-center justify-center text-[13px] text-ink-2', bg, className)}>
      <span className="flex items-center gap-1.5">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="M21 16l-5-5-8 9" />
        </svg>
        {label}
      </span>
    </div>
  );
}
