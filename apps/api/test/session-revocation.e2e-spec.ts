/**
 * The query behind immediate sign-out: JwtAuthGuard only accepts an access token while
 * SessionsService.findActive finds its session (implementation plan, M0 5.2).
 *
 *   DATABASE_URL_TEST=postgres://localhost:5432/hongwang_test pnpm --filter @hongwang/api test:e2e
 */
import { eq } from 'drizzle-orm';
import type { Pool } from 'pg';
import { envSchema } from '../src/config/env';
import { createDatabase, type Database } from '../src/database/database.module';
import { sessions, users } from '../src/database/schema';
import { SessionsService } from '../src/modules/users/sessions.service';
import { SKIP_ENV, testDatabaseUrl, truncateAll } from './setup/database';
import { createUser } from './setup/fixtures';

const skipReason = process.env[SKIP_ENV];
const describeDb = skipReason ? describe.skip : describe;

const META = { userAgent: 'jest', ip: '127.0.0.1' };

describeDb('SessionsService.findActive (real Postgres)', () => {
  let db: Database;
  let pool: Pool;
  let service: SessionsService;

  beforeAll(() => {
    ({ db, pool } = createDatabase(testDatabaseUrl()!, 5));
    const env = envSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl(),
      JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdef0123',
      JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdef012',
    });
    service = new SessionsService(db, env);
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await truncateAll(db);
  });

  it('finds an active session with the user’s current role', async () => {
    const user = await createUser(db, 'ann');
    const { sessionId } = await service.create(user.id, META);
    expect(await service.findActive(sessionId, user.id)).toEqual({ role: 'user' });

    await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
    expect(await service.findActive(sessionId, user.id)).toEqual({ role: 'admin' });
  });

  it('ignores revoked and expired sessions, and sessions of another user', async () => {
    const ann = await createUser(db, 'ann');
    const bob = await createUser(db, 'bob');
    const revoked = await service.create(ann.id, META);
    const expired = await service.create(ann.id, META);
    const bobs = await service.create(bob.id, META);

    await service.revoke(ann.id, revoked.sessionId);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1_000) }).where(eq(sessions.id, expired.sessionId));

    expect(await service.findActive(revoked.sessionId, ann.id)).toBeNull();
    expect(await service.findActive(expired.sessionId, ann.id)).toBeNull();
    expect(await service.findActive(bobs.sessionId, ann.id)).toBeNull();
    expect(await service.findActive(bobs.sessionId, bob.id)).toEqual({ role: 'user' });
  });

  it('ends every session of a suspended or deleted user', async () => {
    const suspended = await createUser(db, 'sue');
    const deleted = await createUser(db, 'dan');
    const a = await service.create(suspended.id, META);
    const b = await service.create(deleted.id, META);

    await db.update(users).set({ suspendedAt: new Date() }).where(eq(users.id, suspended.id));
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted.id));

    expect(await service.findActive(a.sessionId, suspended.id)).toBeNull();
    expect(await service.findActive(b.sessionId, deleted.id)).toBeNull();
  });

  it('signing out other devices keeps only the caller’s session', async () => {
    const user = await createUser(db, 'ann');
    const here = await service.create(user.id, META);
    const phone = await service.create(user.id, META);
    const laptop = await service.create(user.id, META);

    expect(await service.revokeAll(user.id, { except: here.sessionId })).toBe(2);

    expect(await service.findActive(here.sessionId, user.id)).toEqual({ role: 'user' });
    expect(await service.findActive(phone.sessionId, user.id)).toBeNull();
    expect(await service.findActive(laptop.sessionId, user.id)).toBeNull();
  });
});
