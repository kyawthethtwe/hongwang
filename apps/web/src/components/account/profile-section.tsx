'use client';

import { updateProfileInputSchema, type MeDto, type UpdateProfileInput } from '@hongwang/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/feedback';
import { Field, Input, Label, Textarea } from '@/components/ui/field';
import { apiFetch, errorMessage } from '@/lib/api/client';
import { applyFieldErrors, formErrorMap } from '@/lib/auth/form';
import { formatPhone } from '@/lib/auth/phone';
import { useUpdateProfile } from '@/lib/auth/queries';
import { AvatarUploader } from './avatar-uploader';
import { Note, SectionHeading } from './section';

const shape = updateProfileInputSchema.shape;
/** The editable profile fields, from the shared UpdateProfileInput rules. */
const profileFormSchema = z.object({
  firstName: shape.firstName.unwrap(),
  lastName: z.string().trim().max(60),
  about: z.string().trim().max(500, 'Keep it under 500 characters'),
});
type ProfileForm = z.input<typeof profileFormSchema>;

const toForm = (u: MeDto): ProfileForm => ({ firstName: u.firstName, lastName: u.lastName, about: u.about ?? '' });

export function ProfileSection({ user }: { user: MeDto }) {
  const emailId = useId();
  const phoneId = useId();
  const update = useUpdateProfile();
  const resend = useMutation({
    mutationFn: () => apiFetch('/auth/email/resend', { method: 'POST' }),
    onSuccess: () => toast.success(`We sent a verification link to ${user.email}`),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, dirtyFields, isSubmitting },
  } = useForm({ resolver: zodResolver(profileFormSchema, formErrorMap), defaultValues: toForm(user) });

  // Keep the form in step with the saved profile (after saving, or an edit in another tab).
  useEffect(() => {
    if (!isDirty) reset(toForm(user));
  }, [user, isDirty, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const patch: UpdateProfileInput = {};
    if (dirtyFields.firstName) patch.firstName = v.firstName;
    if (dirtyFields.lastName) {
      if (!v.lastName) return setError('lastName', { message: 'Enter your last name' });
      patch.lastName = v.lastName;
    }
    if (dirtyFields.about) patch.about = v.about || null;
    try {
      const saved = await update.mutateAsync(patch);
      reset(toForm(saved));
      toast.success('Profile saved');
    } catch (err) {
      if (!applyFieldErrors(err, setError, ['firstName', 'lastName', 'about'])) toast.error(errorMessage(err));
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <SectionHeading>Profile</SectionHeading>
      <AvatarUploader user={user} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName?.message}>
          {(p) => <Input autoComplete="given-name" {...p} {...register('firstName')} />}
        </Field>
        <Field label="Last name" error={errors.lastName?.message}>
          {(p) => <Input autoComplete="family-name" {...p} {...register('lastName')} />}
        </Field>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <div className="flex min-h-6 flex-wrap items-center gap-2">
            <Label htmlFor={emailId}>Email</Label>
            {user.email &&
              (user.emailVerified ? (
                <Badge tone="brand" className="px-2 py-0.5">Verified</Badge>
              ) : (
                <>
                  <Badge tone="warn" className="px-2 py-0.5">Not verified</Badge>
                  <Button variant="link" size="sm" className="-my-2 text-sm" loading={resend.isPending} onClick={() => resend.mutate()}>
                    Verify
                  </Button>
                </>
              ))}
          </div>
          <Input
            id={emailId}
            type="email"
            readOnly
            value={user.email ?? ''}
            placeholder="No email on this account"
            aria-describedby={`${emailId}-hint`}
            className="bg-canvas"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <div className="flex min-h-6 flex-wrap items-center gap-2">
            <Label htmlFor={phoneId}>Mobile</Label>
            {user.phone && user.phoneVerified && <Badge tone="brand" className="px-2 py-0.5">Verified</Badge>}
          </div>
          <Input
            id={phoneId}
            type="tel"
            readOnly
            value={user.phone ? formatPhone(user.phone) : ''}
            placeholder="No mobile number on this account"
            aria-describedby={`${emailId}-hint`}
            className="bg-canvas"
          />
          <p id={`${emailId}-hint`} className="m-0 text-[13px] text-muted">
            Changing your email or mobile number isn’t available yet.
          </p>
        </div>

        <Field label="About you" error={errors.about?.message} className="sm:col-span-2">
          {(p) => <Textarea rows={3} className="resize-y" {...p} {...register('about')} />}
        </Field>
      </div>

      <Note>
        Hosts see your first name, photo and “About you” when you request a stay. Your phone and email stay private until a booking
        is confirmed.
      </Note>
      <Button type="submit" size="lg" className="self-start px-[22px]" loading={isSubmitting} disabled={!isDirty}>
        Save changes
      </Button>
    </form>
  );
}
