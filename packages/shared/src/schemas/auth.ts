import { z } from 'zod';
import type { KycStatus, UserRole } from '../enums';

/**
 * Auth contract. Owner: Auth & Accounts module.
 * Sessions are httpOnly cookies set by the API (access 'hw_at' 15 min, refresh 'hw_rt' 30 days,
 * rotated on every refresh). The web app never sees tokens. Every endpoint below is under /api.
 *
 *   POST /auth/register            RegisterInput            -> AuthResponse   (sets cookies)
 *   POST /auth/login               LoginInput               -> AuthResponse   (sets cookies)
 *   POST /auth/refresh             (refresh cookie)         -> AuthResponse   (rotates cookies)
 *   POST /auth/logout              -                        -> 204            (clears cookies)
 *   GET  /auth/me                  -                        -> MeDto | 401
 *   POST /auth/phone/send-code     PhoneSendCodeInput       -> PhoneSendCodeResponse
 *   POST /auth/phone/verify        PhoneVerifyInput         -> AuthResponse   (signs in or signs up)
 *   POST /auth/password/forgot     ForgotPasswordInput      -> 204 (always, no account enumeration)
 *   POST /auth/password/reset      ResetPasswordInput       -> 204
 *   POST /auth/email/verify        VerifyEmailInput         -> 204
 *   POST /auth/email/resend        -                        -> 204
 *   GET  /auth/google              ?next=/path&connect=1    (redirect, only when GOOGLE_CLIENT_ID is set)
 *   GET  /auth/google/callback     (redirect back to WEB_ORIGIN + next, or /login?error=<GoogleAuthError>)
 *   DELETE /auth/google            -                        -> 204 | 409 (no other way to sign in)
 *   GET  /auth/providers           -                        -> AuthProvidersDto
 *
 * Phone sign-up: POST /auth/phone/verify without firstName/lastName for a phone that has no account
 * yet answers 400 VALIDATION_FAILED with issues on `firstName` / `lastName` (the code is kept), so
 * the client asks for a name and sends the same code again.
 */

export const PASSWORD_MIN_LENGTH = 10;

export const emailSchema = z.email().max(254).transform((v) => v.trim().toLowerCase());
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`).max(200);
/**
 * E.164 shape, e.g. +66812345678. The API also checks it's a real mobile number with
 * `mobilePhoneSchema` from '@hongwang/shared/phone' (a separate entry, so the phone metadata stays
 * out of every page's bundle).
 */
export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use international format, e.g. +66812345678');

export const registerInputSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: emailSchema,
  password: passwordSchema,
  lineOptIn: z.boolean().optional().default(false),
});
export type RegisterInput = z.input<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
export type LoginInput = z.input<typeof loginInputSchema>;

export const phoneSendCodeInputSchema = z.object({ phone: phoneSchema });
export type PhoneSendCodeInput = z.infer<typeof phoneSendCodeInputSchema>;
export interface PhoneSendCodeResponse {
  expiresInSec: number;
  resendInSec: number;
}

export const phoneVerifyInputSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  /** Needed only when this phone has no account yet. */
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
});
export type PhoneVerifyInput = z.infer<typeof phoneVerifyInputSchema>;

export const forgotPasswordInputSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordInputSchema>;

export const resetPasswordInputSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;

export const verifyEmailInputSchema = z.object({ token: z.string().min(20).max(200) });
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;

/** The signed-in user, as the web app sees them. */
export interface MeDto {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  avatarUrl: string | null;
  about: string | null;
  role: UserRole;
  kycStatus: KycStatus;
  /** True once the user has created at least one listing. */
  isHost: boolean;
  locale: string;
  currency: string;
  timezone: string;
  hasPassword: boolean;
  /** When the password was last set (ISO), null when the account has none. */
  passwordChangedAt: string | null;
  /** A Google account is linked. */
  googleConnected: boolean;
  createdAt: string;
}

export interface AuthProvidersDto {
  google: boolean;
}

/** OTP rules for POST /auth/phone/*. */
export const PHONE_OTP = {
  length: 6,
  expiresInSec: 5 * 60,
  resendInSec: 45,
  maxAttempts: 5,
} as const;

/** `error` query value on /login (or /account for connect) after a failed Google sign-in. */
export const GOOGLE_AUTH_ERRORS = ['google', 'google_state', 'google_email_unverified', 'google_in_use', 'suspended'] as const;
export type GoogleAuthError = (typeof GOOGLE_AUTH_ERRORS)[number];

export interface AuthResponse {
  user: MeDto;
  /** True when this call created the account (phone sign-up, Google). */
  isNew?: boolean;
}

/** Access-token payload. */
export interface JwtPayload {
  sub: string;
  role: UserRole;
  sid: string; // session id
}

export const AUTH_COOKIES = {
  access: 'hw_at',
  refresh: 'hw_rt',
} as const;
