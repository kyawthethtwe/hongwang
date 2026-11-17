import Link from 'next/link';
import { Logo } from '@/components/layout/logo';

/** Sign in, password reset and email verification (design A4): logo + "Keep browsing", centred card. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-3.5 sm:px-10">
        <Logo />
        <Link href="/" className="inline-flex min-h-11 items-center px-3 font-medium">
          Keep browsing
        </Link>
      </header>
      <main className="flex flex-1 justify-center px-4 pt-10 pb-16 sm:px-6 sm:pt-14 sm:pb-[72px]">{children}</main>
    </div>
  );
}
