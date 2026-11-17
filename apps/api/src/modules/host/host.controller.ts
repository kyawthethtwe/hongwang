import {
  hostCalendarListingParamSchema,
  hostCalendarQuerySchema,
  hostIdentityInputSchema,
  hostOnboardingInputSchema,
  hostReservationsQuerySchema,
  setBlocksInputSchema,
  setPricesInputSchema,
  type BookingDto,
  type HostCalendarDto,
  type HostDashboardDto,
  type HostOnboardingDto,
} from '@hongwang/shared';
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, type AuthUser } from '../../common/auth';
import { HostService } from './host.service';

class HostReservationsQueryDto extends createZodDto(hostReservationsQuerySchema) {}
class HostCalendarQueryDto extends createZodDto(hostCalendarQuerySchema) {}
class HostCalendarListingParamDto extends createZodDto(hostCalendarListingParamSchema) {}
class SetBlocksDto extends createZodDto(setBlocksInputSchema) {}
class SetPricesDto extends createZodDto(setPricesInputSchema) {}
class HostOnboardingBodyDto extends createZodDto(hostOnboardingInputSchema) {}
class HostIdentityDto extends createZodDto(hostIdentityInputSchema) {}

/** Contract: packages/shared/src/schemas/host.ts. Every route needs a session (global guard). */
@Controller('host')
export class HostController {
  constructor(private readonly host: HostService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser): Promise<HostDashboardDto> {
    return this.host.dashboard(user);
  }

  @Get('reservations')
  reservations(@CurrentUser() user: AuthUser, @Query() query: HostReservationsQueryDto): Promise<BookingDto[]> {
    return this.host.reservations(user, query);
  }

  @Get('calendar')
  calendar(@CurrentUser() user: AuthUser, @Query() query: HostCalendarQueryDto): Promise<HostCalendarDto> {
    return this.host.calendar(user, query);
  }

  @Put('calendar/:listingId/blocks')
  setBlocks(
    @CurrentUser() user: AuthUser,
    @Param() params: HostCalendarListingParamDto,
    @Body() body: SetBlocksDto,
  ): Promise<HostCalendarDto> {
    return this.host.setBlocks(user, params.listingId, body);
  }

  @Put('calendar/:listingId/prices')
  setPrices(
    @CurrentUser() user: AuthUser,
    @Param() params: HostCalendarListingParamDto,
    @Body() body: SetPricesDto,
  ): Promise<HostCalendarDto> {
    return this.host.setPrices(user, params.listingId, body);
  }

  @Get('onboarding')
  onboarding(@CurrentUser() user: AuthUser): Promise<HostOnboardingDto> {
    return this.host.onboarding(user);
  }

  @Put('onboarding')
  saveOnboarding(@CurrentUser() user: AuthUser, @Body() body: HostOnboardingBodyDto): Promise<HostOnboardingDto> {
    return this.host.saveOnboarding(user, body);
  }

  @Post('onboarding/identity')
  @HttpCode(200)
  submitIdentity(@CurrentUser() user: AuthUser, @Body() body: HostIdentityDto): Promise<HostOnboardingDto> {
    return this.host.submitIdentity(user, body);
  }
}
