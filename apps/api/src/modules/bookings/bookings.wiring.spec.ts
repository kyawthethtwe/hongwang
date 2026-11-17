import { QUEUES } from '@hongwang/shared';
import { getQueueToken } from '@nestjs/bullmq';
import { Global, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createMockDb } from '../../../test/helpers/mock-db';
import { AuthzModule } from '../../authz/ability';
import { ENV } from '../../config/env';
import { DB } from '../../database/database.module';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsModule } from '../payments/payments.module';
import { PaymentsService } from '../payments/payments.service';
import { BookingLifecycleService } from './booking-lifecycle.service';
import { BookingReadService } from './booking-read.service';
import { BookingSweepScheduler, BookingTimeoutsProcessor, SWEEP_EVERY_MS } from './booking-timeouts.processor';
import { BookingsModule } from './bookings.module';
import { BookingsService } from './bookings.service';
import { BookingsWorkerModule } from './bookings.worker.module';

const queue = { add: jest.fn(), upsertJobScheduler: jest.fn() };
const infra = [
  { provide: ENV, useValue: { NODE_ENV: 'test', WEB_ORIGIN: 'http://localhost:3000' } },
  { provide: DB, useValue: createMockDb().db },
  { provide: getQueueToken(QUEUES.bookingTimeouts), useValue: queue },
  { provide: getQueueToken(QUEUES.email), useValue: queue },
  { provide: NotificationsService, useValue: { sendEmail: jest.fn() } },
];

@Global()
@Module({ providers: infra, exports: infra.map((p) => p.provide) })
class FakeInfraModule {}

/** Stands in for the Host module: it imports BookingsModule and injects BookingReadService. */
@Injectable()
class NeedsReadModel {
  constructor(readonly read: BookingReadService) {}
}
@Module({ imports: [BookingsModule], providers: [NeedsReadModel] })
class FakeHostModule {}

describe('bookings + payments module wiring', () => {
  it('resolves the HTTP modules and exports BookingReadService to importers', async () => {
    const ref = await Test.createTestingModule({
      imports: [FakeInfraModule, AuthzModule, BookingsModule, PaymentsModule, FakeHostModule],
    }).compile();
    expect(ref.get(BookingsService)).toBeInstanceOf(BookingsService);
    expect(ref.get(PaymentsService)).toBeInstanceOf(PaymentsService);
    expect(ref.get(NeedsReadModel).read).toBeInstanceOf(BookingReadService);
    await ref.close();
  });

  it('resolves the worker module and registers the sweep on init', async () => {
    const ref = await Test.createTestingModule({ imports: [FakeInfraModule, BookingsWorkerModule] }).compile();
    expect(ref.get(BookingTimeoutsProcessor)).toBeInstanceOf(BookingTimeoutsProcessor);
    expect(ref.get(BookingLifecycleService)).toBeInstanceOf(BookingLifecycleService);
    expect(ref.get(BookingSweepScheduler)).toBeDefined();
    await ref.init();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith('sweep', { every: SWEEP_EVERY_MS }, expect.objectContaining({ name: 'sweep' }));
    await ref.close();
  });
});
