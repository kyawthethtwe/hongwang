import type { UserRole } from '@hongwang/shared';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env';
import type { SessionsService } from '../modules/users/sessions.service';
import { JwtAuthGuard, OptionalAuth, Public, type AuthedRequest } from './auth';

const SECRET = 'unit-access-secret-0123456789abcdef0123';
const USER_ID = '0b6f6a52-8f4e-4a43-9a51-6c2c6f9e1d10';
const SESSION_ID = '5d0c1e7a-2b3f-4c6d-8e9f-a0b1c2d3e4f5';
const jwt = new JwtService();

class Routes {
  @Public()
  open() {}

  @OptionalAuth()
  maybe() {}

  closed() {}
}

function context(handler: keyof Routes, req: AuthedRequest): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

const request = (cookie?: string, authorization?: string) =>
  ({ cookies: cookie ? { hw_at: cookie } : {}, headers: authorization ? { authorization } : {} }) as unknown as AuthedRequest;

const accessToken = (payload: Record<string, unknown> = {}, secret = SECRET) =>
  jwt.signAsync({ sub: USER_ID, role: 'user', sid: SESSION_ID, ...payload }, { secret, ...('exp' in payload ? {} : { expiresIn: 900 }) });

function setup(active: { role: UserRole } | null = { role: 'user' }) {
  const findActive = jest.fn(async (_sessionId: string, _userId: string) => active);
  const guard = new JwtAuthGuard(new Reflector(), jwt, { findActive } as unknown as SessionsService, { JWT_ACCESS_SECRET: SECRET } as Env);
  return { guard, findActive };
}

describe('JwtAuthGuard', () => {
  it('accepts a token whose session is active, taking the role from the database', async () => {
    const { guard, findActive } = setup({ role: 'admin' });
    const req = request(await accessToken({ role: 'user' }));
    await expect(guard.canActivate(context('closed', req))).resolves.toBe(true);
    expect(findActive).toHaveBeenCalledWith(SESSION_ID, USER_ID);
    expect(req.user).toEqual({ id: USER_ID, role: 'admin', sessionId: SESSION_ID });
  });

  it('rejects a valid token whose session was revoked (or whose user was suspended or deleted)', async () => {
    const { guard } = setup(null);
    const req = request(await accessToken());
    await expect(guard.canActivate(context('closed', req))).rejects.toThrow(
      new UnauthorizedException('Your session has ended. Please sign in again.'),
    );
    expect(req.user).toBeUndefined();
  });

  it('treats a revoked session as signed out on public and optional routes', async () => {
    const { guard } = setup(null);
    for (const route of ['open', 'maybe'] as const) {
      const req = request(await accessToken());
      await expect(guard.canActivate(context(route, req))).resolves.toBe(true);
      expect(req.user).toBeUndefined();
    }
  });

  it('rejects expired and tampered tokens without a database lookup', async () => {
    const { guard, findActive } = setup();
    const expired = await accessToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    const forged = await accessToken({}, 'someone-elses-secret-0123456789abcdef');
    for (const token of [expired, forged, 'not-a-jwt']) {
      await expect(guard.canActivate(context('closed', request(token)))).rejects.toThrow(new UnauthorizedException('Your session has expired'));
    }
    expect(findActive).not.toHaveBeenCalled();
  });

  it('without a token, protected routes ask to sign in and public ones pass', async () => {
    const { guard, findActive } = setup();
    await expect(guard.canActivate(context('closed', request()))).rejects.toThrow(new UnauthorizedException('Please sign in'));
    await expect(guard.canActivate(context('open', request()))).resolves.toBe(true);
    await expect(guard.canActivate(context('maybe', request()))).resolves.toBe(true);
    expect(findActive).not.toHaveBeenCalled();
  });

  it('accepts a bearer token as well as the cookie', async () => {
    const { guard } = setup();
    const req = request(undefined, `Bearer ${await accessToken()}`);
    await expect(guard.canActivate(context('closed', req))).resolves.toBe(true);
    expect(req.user?.id).toBe(USER_ID);
  });
});
