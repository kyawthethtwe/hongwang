import Link from 'next/link';
import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center">
      <Logo />
      <h1 className="m-0 font-display text-3xl font-bold">We couldn’t find that page</h1>
      <p className="m-0 text-muted">The room may have been unlisted, or the link is out of date.</p>
      <Button asChild>
        <Link href="/">Explore rooms</Link>
      </Button>
    </main>
  );
}
