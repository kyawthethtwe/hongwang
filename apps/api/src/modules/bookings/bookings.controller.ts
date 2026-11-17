import { rejectBookingInputSchema, type BookingDto, type QuoteDto, type RefundQuote } from '@hongwang/shared';
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, OptionalAuth, type AuthUser } from '../../common/auth';
import { badRequest } from '../../common/errors';
import { BookingsService } from './bookings.service';
import {
  BookingIdParams,
  CancelBookingBody,
  CreateBookingBody,
  MyBookingsQueryDto,
  QuoteBody,
} from './bookings.dto';

/** Owner: Bookings & Payments module. Routes: packages/shared/src/schemas/bookings.ts. */
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @OptionalAuth()
  @Post('quote')
  @HttpCode(200)
  quote(@CurrentUser() user: AuthUser | undefined, @Body() body: QuoteBody): Promise<QuoteDto> {
    return this.bookings.quote(user, body);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateBookingBody): Promise<BookingDto> {
    return this.bookings.create(user, body);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: MyBookingsQueryDto): Promise<BookingDto[]> {
    return this.bookings.mine(user, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param() params: BookingIdParams): Promise<BookingDto> {
    return this.bookings.get(user, params.id);
  }

  @Get(':id/cancellation-quote')
  cancellationQuote(@CurrentUser() user: AuthUser, @Param() params: BookingIdParams): Promise<RefundQuote> {
    return this.bookings.cancellationQuote(user, params.id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param() params: BookingIdParams): Promise<BookingDto> {
    return this.bookings.approve(user, params.id);
  }

  /** The body is optional (`{ reason? }`), so it's parsed here instead of by a DTO class. */
  @Post(':id/reject')
  @HttpCode(200)
  reject(@CurrentUser() user: AuthUser, @Param() params: BookingIdParams, @Body() body: unknown): Promise<BookingDto> {
    const parsed = rejectBookingInputSchema.safeParse(body ?? {});
    if (!parsed.success) throw badRequest('Some fields need fixing', parsed.error.issues);
    return this.bookings.reject(user, params.id, parsed.data);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param() params: BookingIdParams, @Body() body: CancelBookingBody): Promise<BookingDto> {
    return this.bookings.cancel(user, params.id, body);
  }
}
