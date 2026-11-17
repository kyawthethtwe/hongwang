import { Lock } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Badge } from '@/components/ui/feedback';

/** Checkout (design A3): a focused header, "Secure checkout · Test mode", no site navigation. */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-10">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-ink-2">
            <Lock aria-hidden className="size-4" />
            Secure checkout
          </span>
          <Badge tone="warn">Test mode</Badge>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
