import { ERROR_CODES, type ErrorCode } from '@hongwang/shared';
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Throw this for every expected failure so the client gets a stable `code`:
 *   throw new AppException(409, ERROR_CODES.datesUnavailable, 'Those dates were just booked');
 */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus | number,
    // `string & {}` keeps editor suggestions for ERROR_CODES while allowing other codes.
    public readonly code: ErrorCode | (string & {}),
    message: string,
    public readonly details?: unknown,
  ) {
    super({ statusCode: status, code, message, details }, status);
  }
}

export const notFound = (what = 'Resource') => new AppException(404, ERROR_CODES.notFound, `${what} not found`);
export const forbidden = (message = 'You can’t do that') => new AppException(403, ERROR_CODES.forbidden, message);
export const conflict = (message: string, code: ErrorCode = ERROR_CODES.conflict) => new AppException(409, code, message);
export const badRequest = (message: string, details?: unknown) =>
  new AppException(400, ERROR_CODES.validation, message, details);

/** Postgres error codes we map to HTTP (see filters/http-exception.filter.ts). */
export const PG_ERRORS = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  checkViolation: '23514',
  exclusionViolation: '23P01',
  serializationFailure: '40001',
} as const;

/** Finds the underlying pg error (Drizzle wraps it in DrizzleQueryError.cause). */
export function pgError(err: unknown): { code: string; constraint?: string; detail?: string } | null {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    if (typeof e === 'object' && e !== null && 'code' in e && typeof (e).code === 'string') {
      const c = (e as { code: string }).code;
      if (/^[0-9A-Z]{5}$/.test(c)) return e as { code: string; constraint?: string; detail?: string };
    }
    e = typeof e === 'object' && e !== null ? (e as { cause?: unknown }).cause : undefined;
  }
  return null;
}

export const isExclusionViolation = (err: unknown) => pgError(err)?.code === PG_ERRORS.exclusionViolation;
export const isUniqueViolation = (err: unknown, constraint?: string) => {
  const e = pgError(err);
  return e?.code === PG_ERRORS.uniqueViolation && (!constraint || e.constraint === constraint);
};
