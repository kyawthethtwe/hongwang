import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginView } from '@/components/auth/login-view';
import { safeNextPath } from '@/lib/auth/next-path';

export const metadata: Metadata = { title: 'Sign in' };

/** /login?mode=signin|signup|phone|reset&next=/path&error=google… (design A4) */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const error = typeof sp.error === 'string' ? sp.error : null;
  return (
    <Suspense>
      <LoginView next={safeNextPath(sp.next)} error={error} />
    </Suspense>
  );
}
