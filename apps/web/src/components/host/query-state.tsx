'use client';

import Link from 'next/link';
import { ApiError, errorMessage } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Banner, Skeleton } from '@/components/ui/feedback';

/** Error banner for a failed query, with sign-in for 401 and a retry otherwise. */
export function QueryError({ error, retry, what = 'this page' }: { error: unknown; retry?: () => void; what?: string }) {
  if (error instanceof ApiError && error.status === 401) {
    return (
      <Banner
        tone="info"
        title="Please sign in."
        action={
          <Button asChild variant="dark">
            <Link href="/login">Sign in</Link>
          </Button>
        }
      >
        You need to be signed in to see {what}.
      </Banner>
    );
  }
  if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
    return (
      <Banner tone="danger" title="Not found.">
        We couldn’t find {what}, or it isn’t yours.
      </Banner>
    );
  }
  return (
    <Banner
      tone="danger"
      title="Couldn’t load."
      action={
        retry && (
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        )
      }
    >
      {errorMessage(error)}
    </Banner>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-72" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-32 w-full rounded-card" />
      ))}
    </div>
  );
}
