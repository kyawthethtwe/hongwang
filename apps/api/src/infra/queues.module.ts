import { QUEUES } from '@hongwang/shared';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env';

/** Parses redis://[:password@]host:port[/db] into BullMQ connection options. */
export function redisConnection(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    username: u.username || undefined,
    db: u.pathname && u.pathname !== '/' ? Number(u.pathname.slice(1)) : undefined,
    tls: u.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

/**
 * Registers the Redis connection and every queue once, globally. Producers anywhere can
 * `@InjectQueue(QUEUES.email) private readonly emailQueue: Queue`.
 * Consumers (@Processor classes) belong in *WorkerModule classes imported only by worker.module.ts.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        connection: redisConnection(env.REDIS_URL),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 7 * 24 * 3600, count: 5000 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      }),
    }),
    BullModule.registerQueue({ name: QUEUES.email }, { name: QUEUES.bookingTimeouts }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
