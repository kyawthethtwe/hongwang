import { IDEMPOTENCY_KEY_HEADER, idempotencyKeySchema } from '@hongwang/shared';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { badRequest } from './errors';

/**
 * Reads and validates the optional Idempotency-Key header (contract in @hongwang/shared, common.ts).
 * Returns null when it's absent; a malformed or repeated header is 400 VALIDATION_FAILED.
 */
export function parseIdempotencyKey(raw: string | string[] | undefined): string | null {
  if (raw === undefined) return null;
  const result = idempotencyKeySchema.safeParse(raw);
  if (!result.success) {
    throw badRequest(`Invalid ${IDEMPOTENCY_KEY_HEADER} header`, [
      { path: [IDEMPOTENCY_KEY_HEADER], message: result.error.issues[0]?.message ?? 'Invalid value' },
    ]);
  }
  return result.data;
}

/** `@IdempotencyKey() key: string | null` in a controller method. */
export const IdempotencyKey = createParamDecorator((_data: unknown, ctx: ExecutionContext) =>
  parseIdempotencyKey(ctx.switchToHttp().getRequest<Request>().headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()]),
);
