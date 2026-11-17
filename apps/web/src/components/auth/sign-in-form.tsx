'use client';

import { loginInputSchema, type AuthResponse } from '@hongwang/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { ApiError, apiFetch, errorMessage } from '@/lib/api/client';
import { applyFieldErrors, formErrorMap } from '@/lib/auth/form';
import { authSubmitClass, TextButton } from './auth-card';

export function SignInForm({ onSignedIn, onForgot }: { onSignedIn: (res: AuthResponse) => void; onForgot: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginInputSchema, formErrorMap), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      onSignedIn(await apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: values }));
    } catch (err) {
      if (applyFieldErrors(err, setError, ['email', 'password'])) return;
      setFormError(err instanceof ApiError && err.status === 429 ? 'Too many attempts. Wait a minute and try again.' : errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      {formError && <Banner tone="danger">{formError}</Banner>}
      <Field label="Email" error={errors.email?.message}>
        {(p) => <Input type="email" autoComplete="email" placeholder="you@example.com" {...p} {...register('email')} />}
      </Field>
      <Field label="Password" error={errors.password?.message}>
        {(p) => <Input type="password" autoComplete="current-password" {...p} {...register('password')} />}
      </Field>
      <TextButton onClick={onForgot} className="self-start text-sm">
        Forgot your password?
      </TextButton>
      <Button type="submit" size="lg" block loading={isSubmitting} className={authSubmitClass}>
        Sign in
      </Button>
    </form>
  );
}
