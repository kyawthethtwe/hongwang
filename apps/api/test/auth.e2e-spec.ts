/**
 * Email + password auth against real Postgres (implementation plan, M0 5.4): register, login,
 * refresh-token rotation, reuse detection, logout and password reset, through AuthService with
 * the real SessionsService and TokenService. Email is a jest mock (it captures the reset link).
 *
 *   DATABASE_URL_TEST=postgres://hongwang:hongwang@localhost:5433/hongwang_test pnpm --filter @hongwang/api test:e2e
 */
import { ERROR_CODES } from '@hongwang/shared';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { Pool } from 'pg';
import { AbilityFactory } from '../src/authz/ability';
import { envSchema } from '../src/config/env';
import { createDatabase, type Database } from '../src/database/database.module';
import { sessions, users } from '../src/database/schema';
import type { StorageService } from '../src/infra/storage/storage.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { GoogleOAuthService } from '../src/modules/auth/google-oauth.service';
import { SmsService } from '../src/modules/auth/sms.service';
import { TokenService } from '../src/modules/auth/token.service';
import { REFRESH_REUSE_GRACE_MS } from '../src/modules/auth/tokens';
import { ListingsService } from '../src/modules/listings/listings.service';
import type { NotificationsService } from '../src/modules/notifications/notifications.service';
import { SessionsService } from '../src/modules/users/sessions.service';
import { UsersService } from '../src/modules/users/users.service';
import { SKIP_ENV, testDatabaseUrl, truncateAll } from './setup/database';

const skipReason = process.env[SKIP_ENV];
const describeDb = skipReason ? describe.skip : describe;

const META = { userAgent: 'jest', ip: '127.0.0.1' };
const PASSWORD = 'correct-horse-battery-1';
const ANN = { firstName: 'Ann', lastName: 'Lee', email: 'ann@e2e.test', password: PASSWORD, lineOptIn: false };

describeDb('AuthService (real Postgres)', () => {
  let db: Database;
  let pool: Pool;
  let auth: AuthService;
  let sessionsService: SessionsService;
  let sendEmail: jest.Mock;

  beforeAll(() => {
    ({ db, pool } = createDatabase(testDatabaseUrl()!, 5));
    const env = envSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl(),
      JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdef0123',
      JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdef012',
    });
    sendEmail = jest.fn(async () => undefined);
    const notifications = { sendEmail } as unknown as NotificationsService;
    sessionsService = new SessionsService(db, env);
    const listingsService = new ListingsService(db, new AbilityFactory(), notifications, env);
    const usersService = new UsersService(db, sessionsService, { delete: jest.fn() } as unknown as StorageService, env, listingsService);
    auth = new AuthService(
      db,
      env,
      usersService,
      sessionsService,
      new TokenService(new JwtService({}), env),
      new SmsService(env),
      new GoogleOAuthService(env),
      notifications,
    );
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await truncateAll(db);
    sendEmail.mockClear();
  });

  const liveSessions = async (userId: string) =>
    (await db.select().from(sessions).where(eq(sessions.userId, userId))).filter((s) => !s.revokedAt);

  it('register: creates the user, a session and a verification email; the email can’t register twice', async () => {
    const { response, tokens } = await auth.register(ANN, META);
    expect(response.user).toMatchObject({ email: 'ann@e2e.test', firstName: 'Ann' });
    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(await liveSessions(response.user.id)).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ template: 'verify-email', to: 'ann@e2e.test' }));

    await expect(auth.register({ ...ANN, email: 'ANN@e2e.test' }, META)).rejects.toMatchObject({ status: 409, code: ERROR_CODES.emailTaken });
  });

  it('login: the right password signs in, a wrong one or an unknown email gets the same 401', async () => {
    await auth.register(ANN, META);
    await expect(auth.login({ email: 'ann@e2e.test', password: PASSWORD }, META)).resolves.toMatchObject({
      response: { user: { email: 'ann@e2e.test' } },
    });
    for (const attempt of [
      { email: 'ann@e2e.test', password: 'wrong-password-123' },
      { email: 'nobody@e2e.test', password: PASSWORD },
    ]) {
      await expect(auth.login(attempt, META)).rejects.toMatchObject({ status: 401, code: ERROR_CODES.invalidCredentials });
    }
  });

  it('refresh: rotates the token; the old one inside the grace window is just stale', async () => {
    const { tokens } = await auth.register(ANN, META);
    const first = await auth.refresh(tokens.refreshCookie, META);
    if (!first.ok) throw new Error('first refresh failed');
    expect(first.result.tokens.refreshCookie).not.toBe(tokens.refreshCookie);

    // A second tab racing the first: refused, but the session survives and cookies aren't cleared.
    await expect(auth.refresh(tokens.refreshCookie, META)).resolves.toEqual({ ok: false, clearCookies: false });
    await expect(auth.refresh(first.result.tokens.refreshCookie, META)).resolves.toMatchObject({ ok: true });
  });

  it('refresh-token reuse after the grace window revokes the whole session', async () => {
    const { response, tokens } = await auth.register(ANN, META);
    const rotated = await auth.refresh(tokens.refreshCookie, META);
    if (!rotated.ok) throw new Error('refresh failed');
    // Make the rotation look older than the grace window.
    await db
      .update(sessions)
      .set({ lastUsedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 1000) })
      .where(eq(sessions.userId, response.user.id));

    await expect(auth.refresh(tokens.refreshCookie, META)).resolves.toEqual({ ok: false, clearCookies: true });
    // The thief's replay also kills the legitimate holder's newer token.
    await expect(auth.refresh(rotated.result.tokens.refreshCookie, META)).resolves.toMatchObject({ ok: false });
    expect(await liveSessions(response.user.id)).toHaveLength(0);
  });

  it('logout revokes the session even with only the refresh cookie', async () => {
    const { response, tokens } = await auth.register(ANN, META);
    const other = await auth.login({ email: 'ann@e2e.test', password: PASSWORD }, META);
    expect(await liveSessions(response.user.id)).toHaveLength(2);

    await auth.logout(undefined, tokens.refreshCookie);
    expect(await liveSessions(response.user.id)).toHaveLength(1);
    await expect(auth.refresh(tokens.refreshCookie, META)).resolves.toMatchObject({ ok: false });
    await expect(auth.refresh(other.tokens.refreshCookie, META)).resolves.toMatchObject({ ok: true });
  });

  it('password reset: the emailed link sets the password once and signs out everywhere', async () => {
    const { response } = await auth.register(ANN, META);
    auth.forgotPassword('ann@e2e.test');
    auth.forgotPassword('nobody@e2e.test'); // no account: nothing happens, no error

    const resetUrl = await waitForResetUrl();
    const token = new URL(resetUrl).searchParams.get('token')!;
    await auth.resetPassword({ token, password: 'a-brand-new-password-9' });

    await expect(auth.login({ email: 'ann@e2e.test', password: PASSWORD }, META)).rejects.toMatchObject({ status: 401 });
    await expect(auth.login({ email: 'ann@e2e.test', password: 'a-brand-new-password-9' }, META)).resolves.toBeDefined();
    // Every session from before the reset is gone (only the login just above is live).
    expect(await liveSessions(response.user.id)).toHaveLength(1);
    await expect(auth.resetPassword({ token, password: 'yet-another-password-7' })).rejects.toMatchObject({
      status: 400,
      code: ERROR_CODES.invalidCode,
    });
    // The link came by email, so it also verified the address.
    const [row] = await db.select().from(users).where(eq(users.id, response.user.id));
    expect(row!.emailVerifiedAt).toBeInstanceOf(Date);
    expect(sendEmail.mock.calls.filter((c) => (c[0] as { template: string }).template === 'password-reset')).toHaveLength(1);
  });

  /** forgotPassword runs in the background (equal timing for unknown emails): wait for its email. */
  async function waitForResetUrl(): Promise<string> {
    for (let i = 0; i < 50; i++) {
      const call = sendEmail.mock.calls.find((c) => (c[0] as { template: string }).template === 'password-reset');
      if (call) return (call[0] as { data: { resetUrl: string } }).data.resetUrl;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('No password-reset email was queued');
  }
});
