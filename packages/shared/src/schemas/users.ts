import { z } from 'zod';
import { passwordSchema } from './auth';

/**
 * Users contract. Owner: Auth & Accounts module.
 *
 *   PATCH  /users/me                         UpdateProfileInput     -> MeDto
 *   POST   /users/me/password                ChangePasswordInput    -> 204
 *   GET    /users/me/sessions                -                      -> SessionDto[]
 *   DELETE /users/me/sessions/:id            -                      -> 204
 *   POST   /users/me/sessions/revoke-others  -                      -> 204
 *   POST   /users/me/avatar/upload-url       AvatarUploadInput      -> UploadTarget
 *   DELETE /users/me                         -                      -> 204 | 409 (upcoming stay)
 *   GET    /users/:id                        -                      -> PublicUserDto
 */

export const updateProfileInputSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  about: z.string().trim().max(500).nullable().optional(),
  avatarUrl: z.url().nullable().optional(),
  locale: z.enum(['en', 'th']).optional(),
  currency: z.enum(['THB', 'USD', 'SGD']).optional(),
  timezone: z.enum(['Asia/Bangkok', 'Asia/Singapore']).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

export const changePasswordInputSchema = z.object({
  /** Omit when the account has no password yet (phone or Google sign-up). */
  currentPassword: z.string().max(200).optional(),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export interface SessionDto {
  id: string;
  /** e.g. "Chrome on macOS" */
  device: string;
  ip: string | null;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
}

/** What anyone may see about a user (a host on a listing, a guest on a request). */
export interface PublicUserDto {
  id: string;
  firstName: string;
  /** "Ploy K." style */
  displayName: string;
  initials: string;
  avatarUrl: string | null;
  about: string | null;
  identityVerified: boolean;
  joinedAt: string;
}

export const avatarUploadInputSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().int().positive().max(5 * 1024 * 1024),
});
export type AvatarUploadInput = z.infer<typeof avatarUploadInputSchema>;

/** Where the browser PUTs a file. Returned by every upload-url endpoint. */
export interface UploadTarget {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  /** Storage key, sent back to the API to attach the file. */
  key: string;
  /** Where the file will be readable once uploaded. */
  publicUrl: string;
}
