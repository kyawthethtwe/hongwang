import { ERROR_CODES } from '@hongwang/shared';
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { IncomingHttpHeaders } from 'node:http';
import { ENV, type Env } from '../config/env';
import { AppException } from './errors';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** The body types a cross-site HTML form, or a fetch with no CORS preflight, can send. */
const FORM_CONTENT_TYPES = new Set(['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain']);

export type CrossSiteProblem = 'origin' | 'content-type';

/**
 * Why an unsafe request looks cross-site, or null. Session cookies are SameSite=Lax, which already
 * keeps them off cross-site POSTs; this also covers login CSRF (no cookie needed) and requests from
 * another subdomain of the same site.
 * - A browser sends `Origin` on every POST, PUT, PATCH and DELETE: it must be the web app or the
 *   API itself (Swagger in development). Servers (Stripe webhooks) and curl send none.
 * - Form-style bodies are refused: every route takes JSON (the local upload takes the image type).
 */
export function crossSiteProblem(req: { method: string; headers: IncomingHttpHeaders }, webOrigin: string): CrossSiteProblem | null {
  if (!UNSAFE_METHODS.has(req.method.toUpperCase())) return null;
  const { origin } = req.headers;
  if (origin !== undefined && !isAllowedOrigin(origin, webOrigin, req.headers.host)) return 'origin';
  const type = req.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
  if (type && FORM_CONTENT_TYPES.has(type)) return 'content-type';
  return null;
}

function isAllowedOrigin(origin: string, webOrigin: string, host: string | undefined): boolean {
  try {
    const url = new URL(origin);
    return url.origin === new URL(webOrigin).origin || url.host === host;
  } catch {
    return false; // "null" (sandboxed frames, file://) or junk
  }
}

/** Global guard (app.module.ts), before throttling and auth. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (ctx.getType() !== 'http') return true;
    const problem = crossSiteProblem(ctx.switchToHttp().getRequest<Request>(), this.env.WEB_ORIGIN);
    if (problem === 'origin') throw new AppException(403, ERROR_CODES.forbidden, 'Cross-site request refused');
    if (problem === 'content-type') {
      throw new AppException(415, ERROR_CODES.unsupportedMediaType, 'Send the request body as JSON');
    }
    return true;
  }
}
