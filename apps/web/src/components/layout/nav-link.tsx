'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Header nav item; `exact` for index routes like /host. */
export function NavLink({ href, exact, children, badge }: { href: string; exact?: boolean; children: React.ReactNode; badge?: number }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-field px-3.5 font-medium no-underline',
        active ? 'bg-subtle font-semibold text-ink hover:text-ink' : 'text-ink-2 hover:bg-subtle hover:text-ink',
      )}
    >
      {children}
      {!!badge && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white">{badge}</span>
      )}
    </Link>
  );
}
