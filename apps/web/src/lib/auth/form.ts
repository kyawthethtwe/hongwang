import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { z } from 'zod';
import { fieldErrors } from '@/lib/api/client';

const FIELD_NAMES: Record<string, string> = {
  firstName: 'your first name',
  lastName: 'your last name',
  email: 'your email',
  password: 'a password',
  newPassword: 'a new password',
  currentPassword: 'your current password',
  phone: 'your mobile number',
  national: 'your mobile number',
  code: 'the 6-digit code',
};

const errorMap: z.core.$ZodErrorMap = (iss) => {
  const field = String(iss.path?.[iss.path.length - 1] ?? '');
  if (iss.code === 'too_small' && iss.origin === 'string' && Number(iss.minimum) === 1) return `Enter ${FIELD_NAMES[field] ?? 'a value'}`;
  if (iss.code === 'invalid_format' && iss.format === 'email') return 'Enter an email address like you@example.com';
  if (iss.code === 'too_big' && iss.origin === 'string') return 'That’s too long';
  return undefined;
};

/**
 * Friendlier zod messages for the auth and account forms (pass as zodResolver's 2nd argument).
 * Messages written on the shared schemas ("At least 10 characters") still win.
 */
export const formErrorMap = { error: errorMap };

/**
 * Copies VALIDATION_FAILED field issues from an API error onto the form. Returns true when at least
 * one landed on a known field (so the caller can skip the generic toast).
 */
export function applyFieldErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, fields: readonly Path<T>[]): boolean {
  const errs = fieldErrors(err);
  let applied = false;
  for (const f of fields) {
    const message = errs[f];
    if (message) {
      setError(f, { type: 'server', message });
      applied = true;
    }
  }
  return applied;
}
