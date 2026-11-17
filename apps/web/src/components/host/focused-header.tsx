import { Logo } from '@/components/layout/logo';
import { cn } from '@/lib/utils';

/**
 * Focused header for onboarding (C1) and the listing editor (C4): logo, an optional status line
 * in the middle, page actions on the right. No main navigation.
 */
export function FocusedHeader({
  hosting = false,
  status,
  actions,
  className,
}: {
  hosting?: boolean;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3 sm:px-10',
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <Logo href="/host" hosting={hosting} />
        {status && <div className="min-w-0 font-medium text-ink-2">{status}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
