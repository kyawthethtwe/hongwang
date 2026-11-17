import type { Request, Response } from 'express';
import {
  accessCookieOptions,
  clearAuthCookies,
  readRefreshCookie,
  refreshCookieOptions,
  setAuthCookies,
} from './cookies';

const env = { COOKIE_SECURE: false, COOKIE_DOMAIN: undefined, REFRESH_TOKEN_TTL_DAYS: 30 };

function mockRes() {
  const calls: { op: 'set' | 'clear'; name: string; value?: string; opts: Record<string, unknown> }[] = [];
  const res = {
    cookie: (name: string, value: string, opts: Record<string, unknown>) => calls.push({ op: 'set', name, value, opts }),
    clearCookie: (name: string, opts: Record<string, unknown>) => calls.push({ op: 'clear', name, opts }),
  } as unknown as Response;
  return { res, calls };
}

describe('auth cookies', () => {
  it('access cookie: httpOnly, lax, path /', () => {
    expect(accessCookieOptions(env)).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 30 * 86_400_000,
    });
  });

  it('refresh cookie is scoped to /api/auth', () => {
    expect(refreshCookieOptions(env)).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/api/auth' });
  });

  it('uses COOKIE_SECURE and COOKIE_DOMAIN', () => {
    const o = refreshCookieOptions({ ...env, COOKIE_SECURE: true, COOKIE_DOMAIN: '.hongwang.app' });
    expect(o.secure).toBe(true);
    expect(o.domain).toBe('.hongwang.app');
    expect('domain' in accessCookieOptions(env)).toBe(false);
  });

  it('sets hw_at and hw_rt, and clears them with the same path and no lifetime', () => {
    const { res, calls } = mockRes();
    setAuthCookies(res, env, { accessToken: 'jwt', refreshCookie: 'sid.token' });
    clearAuthCookies(res, env);
    expect(calls.map((c) => [c.op, c.name, c.value, c.opts.path])).toEqual([
      ['set', 'hw_at', 'jwt', '/'],
      ['set', 'hw_rt', 'sid.token', '/api/auth'],
      ['clear', 'hw_at', undefined, '/'],
      ['clear', 'hw_rt', undefined, '/api/auth'],
    ]);
    for (const c of calls.filter((x) => x.op === 'clear')) expect(c.opts.maxAge).toBeUndefined();
  });

  it('reads the refresh cookie only when it is a non-empty string', () => {
    expect(readRefreshCookie({ cookies: { hw_rt: 'a.b' } } as unknown as Request)).toBe('a.b');
    expect(readRefreshCookie({ cookies: { hw_rt: '' } } as unknown as Request)).toBeUndefined();
    expect(readRefreshCookie({ cookies: { hw_rt: { x: 1 } } } as unknown as Request)).toBeUndefined();
    expect(readRefreshCookie({} as Request)).toBeUndefined();
  });
});
