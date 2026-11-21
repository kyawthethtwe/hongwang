import helmet from 'helmet';
import type { Env } from '../config/env';

/**
 * Security headers for every API response (helmet). The API serves JSON; in production it has no
 * HTML pages at all (Swagger and the email preview exist only outside production), so production
 * gets a CSP that lets nothing load or frame a response. Outside production CSP is off, so those
 * two dev pages keep working.
 *
 * - Cross-Origin-Resource-Policy is `same-site`: in development the web app (:3000) shows images
 *   from /uploads on :4000, the same site. In production the browser reaches the API through the web
 *   origin's /api rewrite, and photos come from R2.
 * - HSTS only in production (it's meaningless over plain http and sticky in browsers).
 */
export function securityHeaders(env: Pick<Env, 'NODE_ENV'>) {
  const production = env.NODE_ENV === 'production';
  return helmet({
    contentSecurityPolicy: production
      ? {
          useDefaults: false,
          directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'none'"],
            formAction: ["'none'"],
          },
        }
      : false,
    crossOriginResourcePolicy: { policy: 'same-site' },
    strictTransportSecurity: production ? { maxAge: 63_072_000, includeSubDomains: true } : false,
  });
}
