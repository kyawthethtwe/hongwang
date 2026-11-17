import { WorkerHost } from '@nestjs/bullmq';
import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { Worker } from 'bullmq';

/** Longest we wait for running jobs on shutdown (container stop grace is usually 30 s). */
export const DRAIN_TIMEOUT_MS = 25_000;

export interface ConsumedQueue {
  queue: string;
  concurrency: number;
}

/**
 * Owner: Notifications & Workers module (worker entrypoint wiring).
 * Finds every BullMQ consumer in the worker process (any @Processor extending WorkerHost, from
 * any module) to log what it consumes, and drains them first on shutdown: `beforeApplicationShutdown`
 * runs before any `onApplicationShutdown`, so running jobs finish while the pg pool, Redis and
 * SMTP are still open. @nestjs/bullmq's own close on shutdown is then a no-op.
 */
@Injectable()
export class WorkerLifecycle implements BeforeApplicationShutdown {
  private readonly logger = new Logger('Worker');

  constructor(private readonly discovery: DiscoveryService) {}

  private workers(): Worker[] {
    return this.discovery
      .getProviders()
      .map((wrapper) => wrapper.instance as unknown)
      .filter((instance): instance is WorkerHost => instance instanceof WorkerHost)
      .flatMap((host) => {
        try {
          return [host.worker];
        } catch {
          return []; // not registered (e.g. manualRegistration)
        }
      });
  }

  /** The queues this process consumes, for the startup log. */
  consumedQueues(): ConsumedQueue[] {
    return this.workers().map((w) => ({ queue: w.name, concurrency: w.concurrency }));
  }

  async beforeApplicationShutdown(signal?: string) {
    const workers = this.workers();
    if (!workers.length) return;
    this.logger.log(`${signal ?? 'Shutdown'}: finishing running jobs on ${workers.map((w) => w.name).join(', ')}`);
    let timer: NodeJS.Timeout | undefined;
    const timedOut = await Promise.race([
      Promise.all(workers.map((w) => w.close())).then(() => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(true), DRAIN_TIMEOUT_MS);
        timer.unref();
      }),
    ]).finally(() => clearTimeout(timer));
    if (timedOut) {
      this.logger.warn(`Jobs still running after ${DRAIN_TIMEOUT_MS / 1000} s; BullMQ will retry them as stalled`);
    } else {
      this.logger.log('All workers closed');
    }
  }
}
