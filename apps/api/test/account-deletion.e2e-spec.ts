/**
 * Account deletion against real Postgres: the users_email_or_phone check (migration 0006) lets a
 * deleted user keep neither email nor phone, and the host's listings come down in the same
 * transaction (ListingsService.removeAllForHost). Implementation plan, M0 5.2.
 *
 *   DATABASE_URL_TEST=postgres://hongwang:hongwang@localhost:5433/hongwang_test pnpm --filter @hongwang/api test:e2e
 */
import { eq } from 'drizzle-orm';
import type { Pool } from 'pg';
import { AbilityFactory } from '../src/authz/ability';
import { envSchema } from '../src/config/env';
import { createDatabase, type Database } from '../src/database/database.module';
import { listings, sessions, users } from '../src/database/schema';
import type { StorageService } from '../src/infra/storage/storage.service';
import { ListingsService } from '../src/modules/listings/listings.service';
import type { NotificationsService } from '../src/modules/notifications/notifications.service';
import { SessionsService } from '../src/modules/users/sessions.service';
import { UsersService } from '../src/modules/users/users.service';
import { SKIP_ENV, testDatabaseUrl, truncateAll } from './setup/database';
import { createListing, createUser } from './setup/fixtures';

const skipReason = process.env[SKIP_ENV];
const describeDb = skipReason ? describe.skip : describe;

describeDb('UsersService.deleteAccount (real Postgres)', () => {
  let db: Database;
  let pool: Pool;
  let service: UsersService;
  let sessionsService: SessionsService;

  beforeAll(() => {
    ({ db, pool } = createDatabase(testDatabaseUrl()!, 5));
    const env = envSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl(),
      JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdef0123',
      JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdef012',
    });
    sessionsService = new SessionsService(db, env);
    const storage = { delete: jest.fn() } as unknown as StorageService;
    const notifications = { sendEmail: jest.fn() } as unknown as NotificationsService;
    const listingsService = new ListingsService(db, new AbilityFactory(), notifications, env);
    service = new UsersService(db, sessionsService, storage, env, listingsService);
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await truncateAll(db);
  });

  it('clears email and phone, takes the listings down and ends every session', async () => {
    const host = await createUser(db, 'host');
    await db.update(users).set({ phone: '+66811119999' }).where(eq(users.id, host.id));
    const live = await createListing(db, host.id);
    const draft = await createListing(db, host.id, { status: 'draft', title: 'Half-finished draft' });
    await sessionsService.create(host.id, { userAgent: 'jest', ip: '127.0.0.1' });

    await service.deleteAccount(host.id);

    const [row] = await db.select().from(users).where(eq(users.id, host.id));
    expect(row).toMatchObject({ email: null, phone: null, googleId: null, passwordHash: null });
    expect(row!.deletedAt).toBeInstanceOf(Date);
    const rows = await db.select().from(listings).where(eq(listings.hostId, host.id));
    expect(rows.map((l) => [l.id, l.status, l.deletedAt instanceof Date]).sort()).toEqual(
      [
        [live.id, 'paused', true],
        [draft.id, 'paused', true],
      ].sort(),
    );
    const open = await db.select().from(sessions).where(eq(sessions.userId, host.id));
    expect(open.every((s) => s.revokedAt instanceof Date)).toBe(true);
  });

  it('still refuses an active user with neither email nor phone', async () => {
    const user = await createUser(db, 'guest');
    await expect(db.update(users).set({ email: null, phone: null }).where(eq(users.id, user.id))).rejects.toMatchObject({
      cause: expect.objectContaining({ code: '23514', constraint: 'users_email_or_phone' }),
    });
  });
});
