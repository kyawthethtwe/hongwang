import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { JwtAuthGuard } from './common/auth';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { HealthController } from './common/health.controller';
import { CoreModule } from './core.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { HostModule } from './modules/host/host.module';
import { ListingsModule } from './modules/listings/listings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SavedModule } from './modules/saved/saved.module';
import { SearchModule } from './modules/search/search.module';
import { UsersModule } from './modules/users/users.module';

/** HTTP entrypoint (src/main.ts). Feature modules are bounded contexts of the monolith. */
@Module({
  imports: [
    CoreModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    AuthModule,
    UsersModule,
    ListingsModule,
    SearchModule,
    SavedModule,
    BookingsModule,
    PaymentsModule,
    HostModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
