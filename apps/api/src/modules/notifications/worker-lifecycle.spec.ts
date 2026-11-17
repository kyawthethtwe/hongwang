import { WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { DiscoveryService } from '@nestjs/core';
import { WorkerLifecycle } from './worker-lifecycle';

describe('WorkerLifecycle', () => {
  class FakeProcessor extends WorkerHost {
    constructor(private readonly w: unknown) {
      super();
    }
    override get worker() {
      return this.w as never;
    }
    process() {
      return Promise.resolve();
    }
  }

  const discovery = (instances: unknown[]) =>
    ({ getProviders: () => instances.map((instance) => ({ instance })) }) as unknown as DiscoveryService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  it('lists the queues consumed by every WorkerHost provider', () => {
    const lifecycle = new WorkerLifecycle(
      discovery([
        new FakeProcessor({ name: 'email', concurrency: 5 }),
        new FakeProcessor({ name: 'booking-timeouts', concurrency: 1 }),
        { notAWorker: true },
        undefined,
      ]),
    );
    expect(lifecycle.consumedQueues()).toEqual([
      { queue: 'email', concurrency: 5 },
      { queue: 'booking-timeouts', concurrency: 1 },
    ]);
  });

  it('closes every worker (waiting for running jobs) before the app shuts down', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const lifecycle = new WorkerLifecycle(discovery([new FakeProcessor({ name: 'email', concurrency: 5, close })]));
    await lifecycle.beforeApplicationShutdown('SIGTERM');
    expect(close).toHaveBeenCalledWith();
  });
});
