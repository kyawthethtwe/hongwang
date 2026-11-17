import { z } from 'zod';

export const uuidSchema = z.uuid();
export const isoDateSchema = z.iso.date(); // 'YYYY-MM-DD'
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
/** Money in satang, see money.ts. */
export const satangSchema = z.number().int().nonnegative();

export const idParamSchema = z.object({ id: z.uuid() });
export type IdParam = z.infer<typeof idParamSchema>;

export const pageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Stay range with checkOut strictly after checkIn. */
export const stayRangeSchema = z
  .object({ checkIn: isoDateSchema, checkOut: isoDateSchema })
  .refine((v) => v.checkOut > v.checkIn, { message: 'Check-out must be after check-in', path: ['checkOut'] });

/**
 * Error body every API error returns (see apps/api/src/common/filters/http-exception.filter.ts).
 * `code` is a stable machine-readable string, e.g. 'DATES_UNAVAILABLE', 'VALIDATION_FAILED'.
 */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export const ERROR_CODES = {
  validation: 'VALIDATION_FAILED',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  notFound: 'NOT_FOUND',
  conflict: 'CONFLICT',
  datesUnavailable: 'DATES_UNAVAILABLE',
  invalidTransition: 'INVALID_TRANSITION',
  holdExpired: 'HOLD_EXPIRED',
  ownListing: 'OWN_LISTING',
  rateLimited: 'RATE_LIMITED',
  invalidCredentials: 'INVALID_CREDENTIALS',
  emailTaken: 'EMAIL_TAKEN',
  invalidCode: 'INVALID_CODE',
  internal: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
