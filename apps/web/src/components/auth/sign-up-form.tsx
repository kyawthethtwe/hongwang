'use client';

import { PASSWORD_MIN_LENGTH, registerInputSchema, type AuthResponse } from '@hongwang/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { ApiError, apiFetch, errorMessage } from '@/lib/api/client';
import { applyFieldErrors, formErrorMap } from '@/lib/auth/form';
import { authSubmitClass } from './auth-card';

export function SignUpForm({ onSignedIn }: { onSignedIn: (res: AuthResponse) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerInputSchema, formErrorMap),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', lineOptIn: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      onSignedIn(await apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: values }));
    } catch (err) {
      if (applyFieldErrors(err, setError, ['firstName', 'lastName', 'email', 'password'])) return;
      setFormError(err instanceof ApiError && err.status === 429 ? 'Too many attempts. Wait a minute and try again.' : errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      {formError && <Banner tone="danger">{formError}</Banner>}
      <div className="grid grid-cols-1 gap-3.5 min-[400px]:grid-cols-2">
        <Field label="First name" error={errors.firstName?.message}>
          {(p) => <Input autoComplete="given-name" {...p} {...register('firstName')} />}
        </Field>
        <Field label="Last name" error={errors.lastName?.message}>
          {(p) => <Input autoComplete="family-name" {...p} {...register('lastName')} />}
        </Field>
      </div>
      <Field label="Email" error={errors.email?.message}>
        {(p) => <Input type="email" autoComplete="email" placeholder="you@example.com" {...p} {...register('email')} />}
      </Field>
      <Field
        label="Password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A long phrase works well.`}
        error={errors.password?.message}
      >
        {(p) => <Input type="password" autoComplete="new-password" {...p} {...register('password')} />}
      </Field>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-2">
        <Checkbox className="mt-0.5" {...register('lineOptIn')} />
        Send me booking updates on LINE as well as email
      </label>
      <Button type="submit" size="lg" block loading={isSubmitting} className={authSubmitClass}>
        Create account
      </Button>
    </form>
  );
}
