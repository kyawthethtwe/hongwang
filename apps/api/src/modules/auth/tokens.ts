import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Opaque tokens: refresh tokens, email-verification and password-reset links.
 * Only the sha256 hash is stored; the raw value lives in the cookie or the emailed link.
 */
export const TOKEN_BYTES = 32;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
/** base64url length of TOKEN_BYTES random bytes (no padding). */
const TOKEN_CHARS = Math.ceil((TOKEN_BYTES * 4) / 3);

/** 32 random bytes as base64url (43 chars). */
export function randomToken(bytes = TOKEN_BYTES): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time string comparison (hex digests, cookie values). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface RefreshCookie {
  sessionId: string;
  token: string;
}

/** Refresh cookie value: `<sessionId>.<token>`. */
export function formatRefreshCookie(sessionId: string, token: string): string {
  return `${sessionId}.${token}`;
}

/** Parses `<sessionId>.<token>`; null for anything malformed (never throws). */
export function parseRefreshCookie(value: unknown): RefreshCookie | null {
  if (typeof value !== 'string' || value.length > 128) return null;
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const sessionId = value.slice(0, dot);
  const token = value.slice(dot + 1);
  if (!UUID_RE.test(sessionId)) return null;
  if (token.length !== TOKEN_CHARS || !BASE64URL_RE.test(token)) return null;
  return { sessionId: sessionId.toLowerCase(), token };
}

/** Why a refresh cookie was refused. Only `reuse` revokes the session. */
export type RefreshRejection = 'invalid' | 'revoked' | 'expired' | 'stale' | 'reuse';

/**
 * A rotated-away token arriving within this window is a race between tabs (both sent the same
 * cookie), not theft: refuse it but keep the session.
 */
export const REFRESH_REUSE_GRACE_MS = 10_000;

/**
 * Decides what a refresh with a session id but a non-matching token means.
 * `session` is the row for the cookie's session id (undefined when it doesn't exist).
 */
export function classifyRefreshFailure(
  session: { revokedAt: Date | null; expiresAt: Date; lastUsedAt: Date } | undefined,
  now: Date = new Date(),
): RefreshRejection {
  if (!session) return 'invalid';
  if (session.revokedAt) return 'revoked';
  if (session.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (now.getTime() - session.lastUsedAt.getTime() < REFRESH_REUSE_GRACE_MS) return 'stale';
  return 'reuse';
}
