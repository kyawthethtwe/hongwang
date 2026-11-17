import { ERROR_CODES, type ApiErrorBody } from '@hongwang/shared';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { PG_ERRORS, pgError } from '../errors';

const STATUS_CODES: Record<number, string> = {
  400: ERROR_CODES.validation,
  401: ERROR_CODES.unauthorized,
  403: ERROR_CODES.forbidden,
  404: ERROR_CODES.notFound,
  409: ERROR_CODES.conflict,
  429: ERROR_CODES.rateLimited,
};

/** Turns every error into ApiErrorBody `{ statusCode, code, message, details? }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) this.logger.error(exception);
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as { issues?: unknown[] } | undefined;
      return {
        statusCode: 400,
        code: ERROR_CODES.validation,
        message: 'Some fields need fixing',
        details: zodError?.issues ?? null,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      if (typeof r === 'object' && r !== null && 'code' in r) {
        const o = r as ApiErrorBody;
        return { statusCode: status, code: o.code, message: o.message, details: o.details };
      }
      const message =
        typeof r === 'string' ? r : Array.isArray((r as { message?: unknown }).message)
          ? ((r as { message: string[] }).message).join(', ')
          : ((r as { message?: string }).message ?? exception.message);
      return { statusCode: status, code: STATUS_CODES[status] ?? `HTTP_${status}`, message };
    }

    const pg = pgError(exception);
    if (pg) {
      switch (pg.code) {
        case PG_ERRORS.exclusionViolation:
          return { statusCode: 409, code: ERROR_CODES.datesUnavailable, message: 'Those dates are no longer available' };
        case PG_ERRORS.uniqueViolation:
          return { statusCode: 409, code: ERROR_CODES.conflict, message: 'That already exists' };
        case PG_ERRORS.checkViolation:
          if (pg.constraint === 'bookings_not_own_listing')
            return { statusCode: 403, code: ERROR_CODES.ownListing, message: 'You can’t book your own listing' };
          return { statusCode: 400, code: ERROR_CODES.validation, message: 'Invalid value' };
        case PG_ERRORS.foreignKeyViolation:
          return { statusCode: 400, code: ERROR_CODES.validation, message: 'Referenced record does not exist' };
      }
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: ERROR_CODES.internal, message: 'Something went wrong' };
  }
}
