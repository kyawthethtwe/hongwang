import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerLifecycle } from './modules/notifications/worker-lifecycle';
import { WorkerModule } from './worker.module';

/**
 * Separate entrypoint (whiteboard "Workers"): payment holds, request timeouts, emails, payouts.
 * No HTTP server: it only consumes BullMQ queues. Run with `pnpm --filter @hongwang/api dev:worker`.
 *
 * Shutdown (SIGTERM from the container runtime, or Ctrl-C): Nest runs WorkerLifecycle's
 * beforeApplicationShutdown, which stops taking jobs and waits for running ones, then the
 * onApplicationShutdown hooks close BullMQ, the pg pool and the SMTP pool, then the process exits.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  // useProcessExit: exit(0) after the hooks, so pino flushes its last lines.
  app.enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true });

  const queues = app.get(WorkerLifecycle).consumedQueues();
  const list = queues.map((q) => `${q.queue} (concurrency ${q.concurrency})`).join(', ');
  logger.log(queues.length ? `Worker started, consuming ${list}` : 'Worker started, but no queue consumers are registered');
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console -- the app (and its logger) failed to start
  console.error('Worker failed to start', err);
  process.exit(1);
});
