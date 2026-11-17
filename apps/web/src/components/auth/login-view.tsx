'use client';

import type { AuthResponse, GoogleAuthError } from '@hongwang/shared';
import { useRouter } from 'next/navigation';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { buttonVariants } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { useProviders } from '@/lib/auth/queries';
import { useSession, useSetSession } from '@/lib/auth/session';
import { cn } from '@/lib/utils';
import { AuthCard, AuthHeading, LegalNote } from './auth-card';
import { ForgotPasswordForm } from './forgot-password-form';
import { PhoneSignIn } from './phone-sign-in';
import { SignInForm } from './sign-in-form';
import { SignUpForm } from './sign-up-form';

export const LOGIN_MODES = ['signin', 'signup', 'phone', 'reset'] as const;
export type LoginMode = (typeof LOGIN_MODES)[number];

const COPY: Record<Exclude<LoginMode, 'phone'>, [string, string]> = {
  signin: ['Welcome back', 'Sign in to see your trips and messages.'],
  signup: ['Create your account', 'Book rooms, message hosts and keep your trips in one place.'],
  reset: ['Reset your password', 'Tell us your email and we will send a link to set a new one.'],
};

const GOOGLE_ERRORS: Record<GoogleAuthError, string> = {
  google: 'We couldn’t sign you in with Google. Try again, or use your email.',
  google_state: 'That Google sign-in took too long or was opened in another browser. Try again.',
  google_email_unverified: 'Your Google email isn’t verified, so we can’t link it to your Hongwang account. Sign in with your password instead.',
  google_in_use: 'That Google account is already linked to another Hongwang account.',
  suspended: 'This account is suspended. Contact support if you think this is a mistake.',
};

/** /login (design A4): sign in, create account, phone code, reset. `next` is already sanitised. */
export function LoginView({ next, error }: { next: string | null; error: string | null }) {
  const router = useRouter();
  const setSession = useSetSession();
  const { user, isLoading } = useSession();
  const providers = useProviders();
  const [mode, setMode] = useQueryState('mode', parseAsStringLiteral(LOGIN_MODES).withDefault('signin').withOptions({ history: 'replace' }));

  const destination = next ?? '/';

  // Already signed in (another tab, or the back button): go on.
  useEffect(() => {
    if (!isLoading && user) router.replace(destination);
  }, [isLoading, user, router, destination]);

  function onSignedIn(res: AuthResponse) {
    setSession(res.user);
    if (res.isNew) toast.success(`Welcome to Hongwang, ${res.user.firstName}`);
    router.replace(destination);
    router.refresh();
  }

  const go = (m: LoginMode) => () => void setMode(m === 'signin' ? null : m);
  const showTabs = mode === 'signin' || mode === 'signup';
  const googleHref = `/api/auth/google?${new URLSearchParams({ next: destination })}`;
  const errorText = error ? (GOOGLE_ERRORS[error as GoogleAuthError] ?? GOOGLE_ERRORS.google) : null;

  return (
    <AuthCard>
      {showTabs && (
        <div className="grid grid-cols-2 gap-1 rounded-[14px] bg-subtle p-1">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={go(m)}
              className={cn(
                'min-h-11 cursor-pointer rounded-field border-0 font-semibold text-ink transition-colors',
                mode === m ? 'bg-surface shadow-pop' : 'bg-transparent hover:bg-surface/60',
              )}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}

      {mode !== 'phone' && <AuthHeading title={COPY[mode][0]} subtitle={COPY[mode][1]} />}
      {errorText && showTabs && <Banner tone="danger">{errorText}</Banner>}

      {mode === 'signin' && <SignInForm onSignedIn={onSignedIn} onForgot={go('reset')} />}
      {mode === 'signup' && <SignUpForm onSignedIn={onSignedIn} />}
      {mode === 'phone' && <PhoneSignIn onSignedIn={onSignedIn} onUseEmail={go('signin')} />}
      {mode === 'reset' && <ForgotPasswordForm onBack={go('signin')} />}

      {showTabs && (
        <>
          <div className="flex items-center gap-3 text-[13px] text-muted">
            <span aria-hidden className="h-px flex-1 bg-line" />
            or
            <span aria-hidden className="h-px flex-1 bg-line" />
          </div>
          <div className="flex flex-col gap-2.5">
            {providers.data?.google && (
              // Full navigation: the API redirects to Google and back.
              <a href={googleHref} className={buttonVariants({ variant: 'outline', size: 'lg', block: true })}>
                Continue with Google
              </a>
            )}
            <button type="button" onClick={go('phone')} className={buttonVariants({ variant: 'outline', size: 'lg', block: true })}>
              Continue with phone number
            </button>
          </div>
        </>
      )}

      <LegalNote />
    </AuthCard>
  );
}
