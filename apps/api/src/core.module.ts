import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthzModule } from './authz/ability';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './infra/logger.module';
import { QueuesModule } from './infra/queues.module';
import { StorageModule } from './infra/storage/storage.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

/** Infrastructure shared by the HTTP app and the worker. All of these are global. */
@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    DatabaseModule,
    AuthzModule,
    QueuesModule,
    StorageModule,
    JwtModule.register({ global: true }),
    NotificationsModule,
  ],
})
export class CoreModule {}
