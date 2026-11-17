'use client';

import { forgotPasswordInputSchema } from '@hongwang/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { ApiError, apiFetch, errorMessage } from '@/lib/api/client';
import { applyFieldErrors, formErrorMap } from '@/lib/auth/form';
import { authSubmitClass, TextButton } from './auth-card';

export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordInputSchema, formErrorMap), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSent(false);
    try {
      await apiFetch('/auth/password/forgot', { method: 'POST', body: values });
      setSent(true);
    } catch (err) {
      if (applyFieldErrors(err, setError, ['email'])) return;
      setFormError(err instanceof ApiError && err.status === 429 ? 'Too many requests. Wait a minute and try again.' : errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      {formError && <Banner tone="danger">{formError}</Banner>}
      <Field label="Email" error={errors.email?.message}>
        {(p) => <Input type="email" autoComplete="email" placeholder="you@example.com" {...p} {...register('email')} />}
      </Field>
      <Button type="submit" size="lg" block loading={isSubmitting} className={authSubmitClass}>
        Send reset link
      </Button>
      {sent && (
        <p role="status" className="m-0 rounded-field bg-brand-soft px-3.5 py-3 text-sm text-brand-ink">
          If that email has an account, a reset link is on its way. It works for 30 minutes.
        </p>
      )}
      <TextButton onClick={onBack}>Back to sign in</TextButton>
    </form>
  );
}
