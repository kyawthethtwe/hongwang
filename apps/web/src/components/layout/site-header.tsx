'use client';

import Link from 'next/link';
import { useSession } from '@/lib/auth/session';
import { Logo } from './logo';
import { NavLink } from './nav-link';
import { UserMenu } from './user-menu';

/**
 * Guest header (design A1, B1-B6). `center` slot for the compact search summary on listing pages.
 */
export function SiteHeader({ center }: { center?: React.ReactNode }) {
  const { user } = useSession();
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3.5 sm:px-10">
      <div className="flex flex-wrap items-center gap-7">
        <Logo />
        {user && (
          <nav aria-label="Main" className="hidden flex-wrap gap-1 md:flex">
            <NavLink href="/" exact>Explore</NavLink>
            <NavLink href="/trips">Trips</NavLink>
            <NavLink href="/saved">Saved</NavLink>
          </nav>
        )}
      </div>
      {center}
      <nav aria-label="Account" className="flex flex-wrap items-center gap-1.5">
        <Link
          href="/host"
          className="inline-flex min-h-11 items-center rounded-full px-3.5 font-medium text-ink no-underline hover:bg-subtle hover:text-ink"
        >
          Switch to hosting
        </Link>
        <UserMenu mode="guest" />
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-4 pt-5 pb-8 text-[13px] text-muted sm:px-10">
      Hongwang · Portfolio project · Prices in Thai baht, before cleaning and service fees
    </footer>
  );
}
