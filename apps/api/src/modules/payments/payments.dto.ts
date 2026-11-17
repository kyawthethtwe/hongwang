import { bookingIdParamSchema, createPaymentIntentInputSchema } from '@hongwang/shared';
import { createZodDto } from 'nestjs-zod';

export class CreatePaymentIntentBody extends createZodDto(createPaymentIntentInputSchema) {}
export class BookingIdParamDto extends createZodDto(bookingIdParamSchema) {}
