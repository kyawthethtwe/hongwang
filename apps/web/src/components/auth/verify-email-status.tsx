'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Spinner } from '@/components/ui/spinner';
import { apiFetch, errorMessage } from '@/lib/api/client';
import { loginHref } from '@/lib/auth/next-path';
import { sessionKey, useSession } from '@/lib/auth/session';
import { AuthCard, AuthHeading, authSubmitClass } from './auth-card';

/** /verify-email?token=… : confirms the address as soon as the page opens. */
export function VerifyEmailStatus({ token }: { token: string | null }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const started = useRef(false);
  const verify = useMutation({
    mutationFn: (t: string) => apiFetch('/auth/email/verify', { method: 'POST', body: { token: t } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKey }),
  });
  const resend = useMutation({
    mutationFn: () => apiFetch('/auth/email/resend', { method: 'POST' }),
    onSuccess: () => toast.success(user?.email ? `We sent a new link to ${user.email}` : 'We sent a new link'),
    onError: (err) => toast.error(errorMessage(err)),
  });

  useEffect(() => {
    // Once per page load (StrictMode runs effects twice in development).
    if (!token || started.current) return;
    started.current = true;
    verify.mutate(token);
  }, [token, verify]);

  if (!token || verify.isError) {
    return (
      <AuthCard>
        <AuthHeading title="We couldn’t verify your email" />
        <Banner tone="danger">
          {verify.isError ? errorMessage(verify.error) : 'This link is incomplete. Open the link from the email again.'}
        </Banner>
        {user ? (
          user.emailVerified ? (
            <Button asChild size="lg" block className={authSubmitClass}>
              <Link href="/">Your email is already verified. Keep browsing</Link>
            </Button>
          ) : (
            <Button size="lg" block className={authSubmitClass} loading={resend.isPending} onClick={() => resend.mutate()}>
              Send me a new link
            </Button>
          )
        ) : (
          <Button asChild size="lg" block className={authSubmitClass}>
            <Link href={loginHref('/account')}>Sign in to get a new link</Link>
          </Button>
        )}
      </AuthCard>
    );
  }

  if (verify.isSuccess) {
    return (
      <AuthCard>
        <AuthHeading title="Your email is verified" subtitle="Thanks. Booking updates and receipts will go to this address." />
        <Button asChild size="lg" block className={authSubmitClass}>
          <Link href="/">Find a room</Link>
        </Button>
        <Button asChild variant="outline" size="lg" block>
          <Link href="/account">Go to your account</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div role="status" className="flex items-center gap-3 text-ink-2">
        <Spinner />
        Checking your link…
      </div>
    </AuthCard>
  );
}
