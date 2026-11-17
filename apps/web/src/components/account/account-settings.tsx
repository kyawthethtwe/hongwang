'use client';

import type { GoogleAuthError } from '@hongwang/shared';
import { useRouter } from 'next/navigation';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/feedback';
import { PageTitle } from '@/components/ui/surfaces';
import { loginHref } from '@/lib/auth/next-path';
import { useSession } from '@/lib/auth/session';
import { cn } from '@/lib/utils';
import { NotificationPreferences } from './notification-preferences';
import { PaymentsSection } from './payments-section';
import { PrivacySection } from './privacy-section';
import { ProfileSection } from './profile-section';
import { RegionSection } from './region-section';
import { SectionHeading } from './section';
import { SecuritySection } from './security-section';

const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Login and security' },
  { id: 'payments', label: 'Payment methods' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'region', label: 'Language and region' },
  { id: 'privacy', label: 'Privacy and data' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const CONNECT_ERRORS: Partial<Record<GoogleAuthError, string>> = {
  google_in_use: 'That Google account is already linked to another Hongwang account.',
  google_state: 'Connecting Google took too long. Try again.',
};

/** /account (design B6): section nav on the left (a scrolling row on phones), one section at a time. */
export function AccountSettings() {
  const router = useRouter();
  const { user, isLoading } = useSession();
  const [params, setParams] = useQueryStates(
    {
      section: parseAsStringLiteral(SECTIONS.map((s) => s.id)).withDefault('profile'),
      error: parseAsString,
      google: parseAsString,
    },
    { history: 'replace', scroll: false },
  );
  const section = params.section as SectionId;

  useEffect(() => {
    if (!isLoading && !user) router.replace(loginHref('/account'));
  }, [isLoading, user, router]);

  // Results of "Connect Google" (the API redirects back here).
  useEffect(() => {
    if (params.google === 'connected') toast.success('Google is connected');
    else if (params.error) toast.error(CONNECT_ERRORS[params.error as GoogleAuthError] ?? 'We couldn’t connect Google. Try again.');
    else return;
    void setParams({ google: null, error: null });
  }, [params.google, params.error, setParams]);

  return (
    <main className="mx-auto box-border max-w-[1120px] px-4 pt-8 pb-14 sm:px-10">
      <PageTitle className="mb-6">Account</PageTitle>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
        <nav
          aria-label="Account sections"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:w-[240px] md:shrink-0 md:flex-col md:gap-0.5 md:overflow-visible md:p-0"
        >
          {SECTIONS.map((s) => {
            const current = s.id === section;
            return (
              <button
                key={s.id}
                type="button"
                aria-current={current ? 'page' : undefined}
                onClick={() => void setParams({ section: s.id === 'profile' ? null : s.id })}
                className={cn(
                  'min-h-11 shrink-0 cursor-pointer rounded-field border-0 px-3.5 text-left whitespace-nowrap text-ink transition-colors',
                  current ? 'bg-subtle font-semibold' : 'bg-transparent font-medium hover:bg-subtle',
                )}
              >
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {!user ? (
            <AccountSkeleton />
          ) : section === 'profile' ? (
            <ProfileSection user={user} />
          ) : section === 'security' ? (
            <SecuritySection user={user} />
          ) : section === 'payments' ? (
            <PaymentsSection />
          ) : section === 'notifications' ? (
            <>
              <SectionHeading>Notifications</SectionHeading>
              <NotificationPreferences />
            </>
          ) : section === 'region' ? (
            <RegionSection user={user} />
          ) : (
            <PrivacySection />
          )}
        </div>
      </div>
    </main>
  );
}

export function AccountSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="size-[72px] rounded-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12 sm:col-span-2" />
        <Skeleton className="h-24 sm:col-span-2" />
      </div>
    </div>
  );
}
