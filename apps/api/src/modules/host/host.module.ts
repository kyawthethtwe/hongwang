import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { HostController } from './host.controller';
import { HostService } from './host.service';

/**
 * Owner: Host Dashboard module.
 * Host dashboard summary, reservations list, calendar (blocks + special prices), onboarding.
 * Approve / reject / cancel are the Bookings endpoints; listing CRUD is the Listings endpoints.
 * Day-state and dashboard aggregation logic are pure functions in day-states.ts / dashboard.ts.
 */
@Module({
  imports: [BookingsModule],
  controllers: [HostController],
  providers: [HostService],
})
export class HostModule {}
