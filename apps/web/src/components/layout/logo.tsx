import Link from 'next/link';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex size-[34px] items-center justify-center rounded-[9px] bg-brand', className)}>
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
        <path d="M3 21h18" />
        <path d="M14 12h.01" />
      </svg>
    </span>
  );
}

/** Logo tile + wordmark, optionally with the dark "Hosting" pill. */
export function Logo({ href = '/', hosting = false }: { href?: string; hosting?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
      <LogoMark />
      <span className="font-display text-[22px] font-bold tracking-[-0.02em]">Hongwang</span>
      {hosting && <span className="rounded-full bg-ink px-[9px] py-[3px] text-xs font-semibold text-white">Hosting</span>}
    </Link>
  );
}
