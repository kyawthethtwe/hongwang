import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';
import { BookingsWorkerModule } from './modules/bookings/bookings.worker.module';
import { NotificationsWorkerModule } from './modules/notifications/notifications.worker.module';

/** Worker entrypoint (src/worker.ts): BullMQ consumers only, no HTTP. */
@Module({
  imports: [CoreModule, BookingsWorkerModule, NotificationsWorkerModule],
})
export class WorkerModule {}
