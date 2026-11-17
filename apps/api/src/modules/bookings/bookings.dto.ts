import {
  cancelBookingInputSchema,
  createBookingInputSchema,
  idParamSchema,
  myBookingsQuerySchema,
  quoteInputSchema,
  rejectBookingInputSchema,
} from '@hongwang/shared';
import { createZodDto } from 'nestjs-zod';

export class QuoteBody extends createZodDto(quoteInputSchema) {}
export class CreateBookingBody extends createZodDto(createBookingInputSchema) {}
export class MyBookingsQueryDto extends createZodDto(myBookingsQuerySchema) {}
export class RejectBookingBody extends createZodDto(rejectBookingInputSchema) {}
export class CancelBookingBody extends createZodDto(cancelBookingInputSchema) {}
export class BookingIdParams extends createZodDto(idParamSchema) {}
