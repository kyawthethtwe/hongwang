import { createHmac, randomInt } from 'node:crypto';
import { PHONE_OTP } from '@hongwang/shared';
import { safeEqual } from './tokens';

/**
 * Phone one-time codes: 6 digits, 5 min expiry, 45 s resend cooldown, 5 attempts.
 * Codes are stored as an HMAC (keyed with a server secret), because a plain hash of a 6-digit
 * number is trivial to reverse.
 */
export const OTP_TTL_SEC = PHONE_OTP.expiresInSec;
export const OTP_RESEND_COOLDOWN_SEC = PHONE_OTP.resendInSec;
export const OTP_MAX_ATTEMPTS = PHONE_OTP.maxAttempts;

export function generateOtp(): string {
  return randomInt(0, 10 ** PHONE_OTP.length)
    .toString()
    .padStart(PHONE_OTP.length, '0');
}

export function hashOtp(secret: string, phone: string, code: string): string {
  return createHmac('sha256', secret).update(`phone_otp:${phone}:${code}`).digest('hex');
}

/** Seconds until a new code may be sent (0 = now). */
export function resendWaitSec(lastSentAt: Date | null | undefined, now: Date = new Date()): number {
  if (!lastSentAt) return 0;
  const elapsedMs = now.getTime() - lastSentAt.getTime();
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SEC - elapsedMs / 1000));
}

export interface OtpRow {
  tokenHash: string;
  /** Attempts made so far, including the one being checked. */
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
}

export type OtpCheck =
  | { status: 'ok' }
  | { status: 'consumed' | 'expired' | 'locked' }
  | { status: 'mismatch'; attemptsLeft: number };

/** Checks a submitted code against its row. `row.attempts` already counts this attempt. */
export function checkOtp(row: OtpRow, givenHash: string, now: Date = new Date()): OtpCheck {
  if (row.consumedAt) return { status: 'consumed' };
  if (row.expiresAt.getTime() <= now.getTime()) return { status: 'expired' };
  if (row.attempts > OTP_MAX_ATTEMPTS) return { status: 'locked' };
  if (safeEqual(row.tokenHash, givenHash)) return { status: 'ok' };
  return { status: 'mismatch', attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - row.attempts) };
}

/** User-facing message for a failed check. */
export function otpErrorMessage(check: Exclude<OtpCheck, { status: 'ok' }>): string {
  switch (check.status) {
    case 'expired':
      return 'This code has expired. Ask for a new one.';
    case 'locked':
      return 'Too many attempts. Ask for a new code.';
    case 'consumed':
      return 'This code was already used. Ask for a new one.';
    case 'mismatch':
      return check.attemptsLeft > 0
        ? `That code isn’t right. ${check.attemptsLeft} ${check.attemptsLeft === 1 ? 'try' : 'tries'} left.`
        : 'That code isn’t right. Ask for a new code.';
  }
}
