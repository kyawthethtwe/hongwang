'use client';

import { PASSWORD_MIN_LENGTH, resetPasswordInputSchema } from '@hongwang/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { ApiError, apiFetch, errorMessage } from '@/lib/api/client';
import { applyFieldErrors, formErrorMap } from '@/lib/auth/form';
import { sessionKey } from '@/lib/auth/session';
import { AuthCard, AuthHeading, authSubmitClass } from './auth-card';

const schema = resetPasswordInputSchema
  .omit({ token: true })
  .extend({ confirm: resetPasswordInputSchema.shape.password })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The passwords don’t match' });

/** /reset-password?token=… : set a new password from the emailed link. */
export function ResetPasswordForm({ token }: { token: string | null }) {
  const qc = useQueryClient();
  const [done, setDone] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema, formErrorMap), defaultValues: { password: '', confirm: '' } });

  if (!token) {
    return (
      <AuthCard>
        <AuthHeading title="This link is incomplete" subtitle="Open the link from the email again, or ask for a new one." />
        <Button asChild size="lg" block className={authSubmitClass}>
          <Link href="/login?mode=reset">Ask for a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard>
        <AuthHeading title="Your password is updated" subtitle="We signed you out everywhere. Sign in again with your new password." />
        <Button asChild size="lg" block className={authSubmitClass}>
          <Link href="/login">Sign in</Link>
        </Button>
      </AuthCard>
    );
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await apiFetch('/auth/password/reset', { method: 'POST', body: { token, password } });
      qc.setQueryData(sessionKey, null);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CODE') {
        setLinkError(err.message);
        return;
      }
      if (applyFieldErrors(err, setError, ['password'])) return;
      setFormError(errorMessage(err));
    }
  });

  return (
    <AuthCard>
      <AuthHeading title="Set a new password" subtitle="Choose a password you don’t use anywhere else." />
      {linkError ? (
        <>
          <Banner tone="danger">{linkError}</Banner>
          <Button asChild size="lg" block className={authSubmitClass}>
            <Link href="/login?mode=reset">Ask for a new link</Link>
          </Button>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
          {formError && <Banner tone="danger">{formError}</Banner>}
          <Field
            label="New password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters. A long phrase works well.`}
            error={errors.password?.message}
          >
            {(p) => <Input type="password" autoComplete="new-password" autoFocus {...p} {...register('password')} />}
          </Field>
          <Field label="Confirm new password" error={errors.confirm?.message}>
            {(p) => <Input type="password" autoComplete="new-password" {...p} {...register('confirm')} />}
          </Field>
          <Button type="submit" size="lg" block loading={isSubmitting} className={authSubmitClass}>
            Save new password
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
