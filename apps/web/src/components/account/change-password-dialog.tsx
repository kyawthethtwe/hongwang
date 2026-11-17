'use client';

import { changePasswordInputSchema, PASSWORD_MIN_LENGTH, passwordSchema } from '@hongwang/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/field';
import { Dialog, DialogClose, DialogFooter } from '@/components/ui/overlays';
import { apiFetch, errorMessage } from '@/lib/api/client';
import { applyFieldErrors, formErrorMap } from '@/lib/auth/form';
import { authKeys } from '@/lib/auth/queries';

function schemaFor(hasPassword: boolean) {
  return changePasswordInputSchema
    .extend({ confirm: passwordSchema })
    .superRefine((v, ctx) => {
      if (hasPassword && !v.currentPassword) ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: 'Enter your current password' });
      if (v.newPassword !== v.confirm) ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'The passwords don’t match' });
    });
}

/** Change (or, for phone and Google accounts, set) the password. Signs out every other session. */
export function ChangePasswordDialog({ hasPassword, trigger }: { hasPassword: boolean; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={hasPassword ? 'Change password' : 'Set a password'}
      description={
        hasPassword
          ? 'You’ll stay signed in here. Other devices are signed out.'
          : 'Add a password so you can also sign in with your email.'
      }
    >
      {open && <ChangePasswordForm hasPassword={hasPassword} onDone={() => setOpen(false)} />}
    </Dialog>
  );
}

function ChangePasswordForm({ hasPassword, onDone }: { hasPassword: boolean; onDone: () => void }) {
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const schema = useMemo(() => schemaFor(hasPassword), [hasPassword]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema, formErrorMap), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null);
    try {
      await apiFetch('/users/me/password', {
        method: 'POST',
        body: { newPassword, ...(hasPassword ? { currentPassword } : {}) },
      });
      await Promise.all([qc.invalidateQueries({ queryKey: authKeys.me }), qc.invalidateQueries({ queryKey: authKeys.sessions })]);
      toast.success(hasPassword ? 'Password changed. Other devices were signed out.' : 'Password set');
      onDone();
    } catch (err) {
      if (!applyFieldErrors(err, setError, ['currentPassword', 'newPassword'])) setFormError(errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3.5">
      {formError && <Banner tone="danger">{formError}</Banner>}
      {hasPassword && (
        <Field label="Current password" error={errors.currentPassword?.message}>
          {(p) => <Input type="password" autoComplete="current-password" autoFocus {...p} {...register('currentPassword')} />}
        </Field>
      )}
      <Field
        label="New password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A long phrase works well.`}
        error={errors.newPassword?.message}
      >
        {(p) => <Input type="password" autoComplete="new-password" autoFocus={!hasPassword} {...p} {...register('newPassword')} />}
      </Field>
      <Field label="Confirm new password" error={errors.confirm?.message}>
        {(p) => <Input type="password" autoComplete="new-password" {...p} {...register('confirm')} />}
      </Field>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" loading={isSubmitting}>
          {hasPassword ? 'Change password' : 'Set password'}
        </Button>
      </DialogFooter>
    </form>
  );
}
