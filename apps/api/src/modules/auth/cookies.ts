import { AUTH_COOKIES } from '@hongwang/shared';
import type { CookieOptions, Request, Response } from 'express';
import type { Env } from '../../config/env';

/**
 * Every auth cookie the API sets, in one place.
 *
 * - `hw_at` (path /): the access JWT. The JWT itself expires after ACCESS_TOKEN_TTL_SEC, but the
 *   cookie lives as long as the refresh cookie so the web proxy (apps/web/src/proxy.ts) can still
 *   see that a session exists after the JWT expired; the client then refreshes on the first 401.
 * - `hw_rt` (path /api/auth): `<sessionId>.<token>`, only ever sent to the auth endpoints.
 * - `hw_oauth` (path /api/auth/google): Google sign-in state, 10 minutes.
 */
export const REFRESH_COOKIE_PATH = '/api/auth';
export const OAUTH_STATE_COOKIE = 'hw_oauth';
export const OAUTH_STATE_COOKIE_PATH = '/api/auth/google';
export const OAUTH_STATE_TTL_MS = 10 * 60_000;

const DAY_MS = 86_400_000;

type CookieEnv = Pick<Env, 'COOKIE_SECURE' | 'COOKIE_DOMAIN' | 'REFRESH_TOKEN_TTL_DAYS'>;

function baseOptions(env: CookieEnv): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function accessCookieOptions(env: CookieEnv): CookieOptions {
  return { ...baseOptions(env), path: '/', maxAge: env.REFRESH_TOKEN_TTL_DAYS * DAY_MS };
}

export function refreshCookieOptions(env: CookieEnv): CookieOptions {
  return { ...baseOptions(env), path: REFRESH_COOKIE_PATH, maxAge: env.REFRESH_TOKEN_TTL_DAYS * DAY_MS };
}

export function oauthStateCookieOptions(env: CookieEnv): CookieOptions {
  return { ...baseOptions(env), path: OAUTH_STATE_COOKIE_PATH, maxAge: OAUTH_STATE_TTL_MS };
}

/** Options for clearing: same name/path/domain, no lifetime. */
function clearing({ maxAge: _maxAge, expires: _expires, ...rest }: CookieOptions): CookieOptions {
  return rest;
}

export interface IssuedTokens {
  accessToken: string;
  /** `<sessionId>.<token>` */
  refreshCookie: string;
}

export function setAuthCookies(res: Response, env: CookieEnv, tokens: IssuedTokens): void {
  res.cookie(AUTH_COOKIES.access, tokens.accessToken, accessCookieOptions(env));
  res.cookie(AUTH_COOKIES.refresh, tokens.refreshCookie, refreshCookieOptions(env));
}

export function clearAuthCookies(res: Response, env: CookieEnv): void {
  res.clearCookie(AUTH_COOKIES.access, clearing(accessCookieOptions(env)));
  res.clearCookie(AUTH_COOKIES.refresh, clearing(refreshCookieOptions(env)));
}

export function readCookie(req: Request, name: string): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value ? value : undefined;
}

export const readRefreshCookie = (req: Request) => readCookie(req, AUTH_COOKIES.refresh);

export function setOauthStateCookie(res: Response, env: CookieEnv, value: string): void {
  res.cookie(OAUTH_STATE_COOKIE, value, oauthStateCookieOptions(env));
}

export function clearOauthStateCookie(res: Response, env: CookieEnv): void {
  res.clearCookie(OAUTH_STATE_COOKIE, clearing(oauthStateCookieOptions(env)));
}
