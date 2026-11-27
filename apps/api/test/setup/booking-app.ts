import { QUEUES } from '@hongwang/shared';
import { getQueueToken } from '@nestjs/bullmq';
import { Global, Module, type DynamicModule } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Pool } from 'pg';
import { AuthzModule } from '../../src/authz/ability';
import { ENV, envSchema, type Env } from '../../src/config/env';
import { createDatabase, DB, type Database } from '../../src/database/database.module';
import { BookingsModule } from '../../src/modules/bookings/bookings.module';
import { BookingsService } from '../../src/modules/bookings/bookings.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { PaymentsModule } from '../../src/modules/payments/payments.module';
import { PaymentsService } from '../../src/modules/payments/payments.service';

/** Real DB; queues and email are jest mocks so no Redis is needed. */
@Global()
@Module({})
class TestInfraModule {
  static register(values: { env: Env; db: Database; queue: unknown; notifications: unknown }): DynamicModule {
    const providers = [
      { provide: ENV, useValue: values.env },
      { provide: DB, useValue: values.db },
      { provide: getQueueToken(QUEUES.bookingTimeouts), useValue: values.queue },
      { provide: getQueueToken(QUEUES.email), useValue: values.queue },
      { provide: NotificationsService, useValue: values.notifications },
    ];
    return { module: TestInfraModule, global: true, providers, exports: providers.map((p) => p.provide) };
  }
}

export interface BookingTestApp {
  moduleRef: TestingModule;
  db: Database;
  pool: Pool;
  bookings: BookingsService;
  payments: PaymentsService;
  queue: { add: jest.Mock };
  notifications: { sendEmail: jest.Mock };
  close(): Promise<void>;
}

/**
 * BookingsModule + PaymentsModule wired to the real test database. The pool is big enough for 50
 * truly concurrent transactions (Postgres' default max_connections is 100).
 * Payments are simulated unless `stripe` is given: then the real Stripe SDK verifies webhook
 * signatures (no network calls as long as the test events carry their charge inline).
 */
export async function createBookingTestApp(
  url: string,
  opts: { stripe?: { secretKey: string; webhookSecret: string } } = {},
): Promise<BookingTestApp> {
  const { pool, db } = createDatabase(url, 60);
  const env = envSchema.parse({
    NODE_ENV: 'test',
    DATABASE_URL: url,
    JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdef0123',
    JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdef012',
    STRIPE_SECRET_KEY: opts.stripe?.secretKey ?? '', // '' = simulated payments
    ...(opts.stripe ? { STRIPE_WEBHOOK_SECRET: opts.stripe.webhookSecret } : {}),
  });
  const queue = { add: jest.fn(async () => ({})), upsertJobScheduler: jest.fn(async () => ({})) };
  const notifications = { sendEmail: jest.fn(async () => undefined) };

  const moduleRef = await Test.createTestingModule({
    imports: [TestInfraModule.register({ env, db, queue, notifications }), AuthzModule, BookingsModule, PaymentsModule],
  }).compile();
  await moduleRef.init();

  return {
    moduleRef,
    db,
    pool,
    bookings: moduleRef.get(BookingsService),
    payments: moduleRef.get(PaymentsService),
    queue,
    notifications,
    close: async () => {
      await moduleRef.close();
      await pool.end();
    },
  };
}
