import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Who is calling, stored on the session ("Where you're signed in"). */
export interface RequestMeta {
  userAgent: string | null;
  ip: string | null;
}

export function requestMeta(req: Request): RequestMeta {
  const ua = req.headers['user-agent'];
  return {
    userAgent: typeof ua === 'string' && ua ? ua.slice(0, 512) : null,
    ip: req.ip ? req.ip.replace(/^::ffff:/, '').slice(0, 64) : null,
  };
}

/** `@ReqMeta() meta: RequestMeta` */
export const ReqMeta = createParamDecorator((_data: unknown, ctx: ExecutionContext) =>
  requestMeta(ctx.switchToHttp().getRequest<Request>()),
);

/**
 * Only same-site relative paths ("/trips?x=1"), never "//evil.com" or "/\evil.com".
 * Used for the post-sign-in `next` redirect.
 */
export function safeNextPath(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string' || raw.length > 512) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  if (/[\u0000-\u001f\\]/.test(raw)) return fallback;
  return raw;
}
