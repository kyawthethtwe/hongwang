'use client';

import {
  phoneSchema,
  phoneVerifyInputSchema,
  PHONE_OTP,
  type AuthResponse,
  type PhoneSendCodeResponse,
} from '@hongwang/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Field, Input, Label, Select } from '@/components/ui/field';
import { ApiError, apiFetch, errorMessage, fieldErrors } from '@/lib/api/client';
import { applyFieldErrors, formErrorMap } from '@/lib/auth/form';
import { formatPhone, PHONE_COUNTRIES, toE164 } from '@/lib/auth/phone';
import { AuthHeading, authSubmitClass, TextButton } from './auth-card';
import { OtpInput } from './otp-input';

const phoneFormSchema = z
  .object({
    country: z.enum(PHONE_COUNTRIES.map((c) => c.code) as [string, ...string[]]),
    national: z.string().trim().max(20),
  })
  .superRefine((v, ctx) => {
    if (!v.national) {
      ctx.addIssue({ code: 'custom', path: ['national'], message: 'Enter your mobile number' });
      return;
    }
    if (!phoneSchema.safeParse(toE164(v.country, v.national)).success) {
      const example = PHONE_COUNTRIES.find((c) => c.code === v.country)?.example;
      ctx.addIssue({ code: 'custom', path: ['national'], message: `Check the number${example ? `, e.g. ${example}` : ''}` });
    }
  });

/** Code + (for a new account) name. `phone` is added on submit. */
const codeFormSchema = phoneVerifyInputSchema.omit({ phone: true });

/** Seconds left until `until` (ms), ticking every second. */
function useSecondsLeft(until: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Phone sign-in (design A4): number -> 6-digit code -> (new accounts) name. */
export function PhoneSignIn({ onSignedIn, onUseEmail }: { onSignedIn: (res: AuthResponse) => void; onUseEmail: () => void }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);

  async function sendCode(e164: string): Promise<{ ok: true } | { ok: false; error: unknown }> {
    try {
      const res = await apiFetch<PhoneSendCodeResponse>('/auth/phone/send-code', { method: 'POST', body: { phone: e164 } });
      setPhone(e164);
      setResendAt(Date.now() + res.resendInSec * 1000);
      return { ok: true };
    } catch (err) {
      // A code was sent moments ago: go to the code screen and show the wait.
      const wait = err instanceof ApiError ? (err.details as { resendInSec?: number } | undefined)?.resendInSec : undefined;
      if (err instanceof ApiError && err.status === 429 && wait) {
        setPhone(e164);
        setResendAt(Date.now() + wait * 1000);
        return { ok: true };
      }
      return { ok: false, error: err };
    }
  }

  if (!phone) return <PhoneStep onSend={sendCode} onUseEmail={onUseEmail} />;
  return (
    <CodeStep
      phone={phone}
      resendAt={resendAt}
      onResend={() => sendCode(phone)}
      onChangeNumber={() => {
        setPhone(null);
        setResendAt(null);
      }}
      onSignedIn={onSignedIn}
    />
  );
}

function PhoneStep({
  onSend,
  onUseEmail,
}: {
  onSend: (e164: string) => Promise<{ ok: true } | { ok: false; error: unknown }>;
  onUseEmail: () => void;
}) {
  const nationalId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(phoneFormSchema, formErrorMap), defaultValues: { country: '+66', national: '' } });
  const country = PHONE_COUNTRIES.find((c) => c.code === watch('country')) ?? PHONE_COUNTRIES[0];

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    const res = await onSend(toE164(v.country, v.national));
    if (res.ok) return;
    if (fieldErrors(res.error).phone) {
      setError('national', { type: 'server', message: fieldErrors(res.error).phone });
      return;
    }
    setFormError(
      res.error instanceof ApiError && res.error.status === 429 ? 'Too many requests. Wait a minute and try again.' : errorMessage(res.error),
    );
  });

  const errorId = `${nationalId}-error`;
  return (
    <>
      <AuthHeading title="Continue with your phone" subtitle="We text you a one-time code. Standard SMS rates may apply." />
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
        {formError && <Banner tone="danger">{formError}</Banner>}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={nationalId}>Mobile number</Label>
          <div className="flex gap-2">
            <Select aria-label="Country code" className="w-auto shrink-0 px-2.5" {...register('country')}>
              {PHONE_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.iso} {c.code}
                </option>
              ))}
            </Select>
            <Input
              id={nationalId}
              type="tel"
              autoComplete="tel-national"
              placeholder={country.example}
              aria-invalid={errors.national ? true : undefined}
              aria-describedby={errors.national ? errorId : undefined}
              className="min-w-0 flex-1"
              {...register('national')}
            />
          </div>
          {errors.national && (
            <p id={errorId} role="alert" className="m-0 text-[13px] font-medium text-danger-ink">
              {errors.national.message}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" block loading={isSubmitting} className={authSubmitClass}>
          Send code
        </Button>
        <TextButton onClick={onUseEmail}>Use email instead</TextButton>
      </form>
    </>
  );
}

function CodeStep({
  phone,
  resendAt,
  onResend,
  onChangeNumber,
  onSignedIn,
}: {
  phone: string;
  resendAt: number | null;
  onResend: () => Promise<{ ok: true } | { ok: false; error: unknown }>;
  onChangeNumber: () => void;
  onSignedIn: (res: AuthResponse) => void;
}) {
  const hintId = useId();
  const codeErrorId = useId();
  const [needsName, setNeedsName] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const secondsLeft = useSecondsLeft(resendAt);
  const {
    control,
    register,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(codeFormSchema, formErrorMap),
    defaultValues: { code: '', firstName: undefined, lastName: undefined },
  });

  const onSubmit = handleSubmit(async (v) => {
    setFormError(null);
    if (needsName && (!v.firstName || !v.lastName)) {
      if (!v.firstName) setError('firstName', { message: 'Enter your first name' });
      if (!v.lastName) setError('lastName', { message: 'Enter your last name' });
      return;
    }
    try {
      onSignedIn(await apiFetch<AuthResponse>('/auth/phone/verify', { method: 'POST', body: { ...v, phone } }));
    } catch (err) {
      const fe = fieldErrors(err);
      if (!needsName && (fe.firstName || fe.lastName)) {
        // New phone number: the code was right, now we need a name (the code stays valid).
        setNeedsName(true);
        return;
      }
      if (fe.code) backToCode();
      if (applyFieldErrors(err, setError, ['code', 'firstName', 'lastName'])) return;
      setFormError(err instanceof ApiError && err.status === 429 ? 'Too many attempts. Wait a minute and try again.' : errorMessage(err));
    }
  });

  /** Back to an empty code entry (wrong or expired code, or a new code was sent). */
  function backToCode() {
    setNeedsName(false);
    setValue('code', '');
    setValue('firstName', undefined);
    setValue('lastName', undefined);
    clearErrors();
  }

  async function resend() {
    setResending(true);
    setFormError(null);
    const res = await onResend();
    setResending(false);
    if (res.ok) backToCode();
    else setFormError(errorMessage(res.error));
  }

  return (
    <>
      {needsName ? (
        <AuthHeading title="Create your account" subtitle="This number is new to Hongwang. Tell us your name to finish." />
      ) : (
        <AuthHeading title="Enter the code" subtitle={`Check your messages for a ${PHONE_OTP.length}-digit code.`} />
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
        {formError && <Banner tone="danger">{formError}</Banner>}
        {needsName ? (
          <div className="grid grid-cols-1 gap-3.5 min-[400px]:grid-cols-2">
            <Field label="First name" error={errors.firstName?.message}>
              {(p) => <Input autoComplete="given-name" autoFocus {...p} {...register('firstName')} />}
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              {(p) => <Input autoComplete="family-name" {...p} {...register('lastName')} />}
            </Field>
          </div>
        ) : (
          <>
            <Controller
              control={control}
              name="code"
              render={({ field }) => (
                <OtpInput
                  value={field.value}
                  onChange={(next) => {
                    field.onChange(next);
                    if (errors.code) clearErrors('code');
                  }}
                  invalid={!!errors.code}
                  describedBy={[hintId, errors.code ? codeErrorId : null].filter(Boolean).join(' ')}
                  autoFocus
                  length={PHONE_OTP.length}
                />
              )}
            />
            {errors.code && (
              <p id={codeErrorId} role="alert" className="m-0 text-[13px] font-medium text-danger-ink">
                {errors.code.message}
              </p>
            )}
          </>
        )}
        <p id={hintId} className="m-0 text-[13px] text-muted" aria-live="polite">
          Sent to {formatPhone(phone)}.{' '}
          {secondsLeft > 0 ? <>You can ask for a new code in {mmss(secondsLeft)}.</> : <>Didn’t get it? You can ask for a new code now.</>}
        </p>
        {secondsLeft === 0 && (
          <TextButton onClick={resend} disabled={resending} className="-mt-2 self-start text-sm">
            {resending ? 'Sending a new code…' : 'Send a new code'}
          </TextButton>
        )}
        <Button type="submit" size="lg" block loading={isSubmitting} className={authSubmitClass}>
          {needsName ? 'Create account' : 'Verify and continue'}
        </Button>
        <TextButton onClick={onChangeNumber}>Change number</TextButton>
      </form>
    </>
  );
}
