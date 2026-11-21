/**
 * Security headers for every page (next.config.ts `headers()`); /api/* responses carry the API's own.
 *
 * The Content-Security-Policy allows exactly what the app loads:
 * - Stripe.js and its frames (payment form, 3-D Secure): js.stripe.com, hooks.stripe.com, api.stripe.com;
 * - the map style, tiles, fonts and sprites from the style URL's host; MapLibre's blob: workers;
 * - photos and uploads from storage (STORAGE_ORIGINS), plus the image hosts in `images.remotePatterns`.
 *
 * Scripts still need 'unsafe-inline': the App Router inlines its data scripts. Removing it means a
 * per-request nonce in src/proxy.ts and dynamic rendering for every page (implementation plan).
 * Development adds 'unsafe-eval' and ws: for React Refresh and hot reload.
 */

export interface SecurityHeaderOptions {
  dev: boolean;
  /** NEXT_PUBLIC_MAP_STYLE_URL; its origin serves the style, tiles, glyphs and sprites. */
  mapStyleUrl: string;
  /** Where photos are read from and uploads are PUT to (local API, MinIO, R2 endpoint and public bucket). */
  storageOrigins: string[];
}

const STRIPE_SCRIPTS = ['https://js.stripe.com', 'https://*.js.stripe.com'];
const STRIPE_FRAMES = [...STRIPE_SCRIPTS, 'https://hooks.stripe.com'];
/** Hosts next.config.ts `images.remotePatterns` allows; plain <img> tags can load them too. */
const IMAGE_HOSTS = ['https://*.r2.dev', 'https://images.unsplash.com', 'https://*.stripe.com'];

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

export function contentSecurityPolicy({ dev, mapStyleUrl, storageOrigins }: SecurityHeaderOptions): string {
  const map = originOf(mapStyleUrl);
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...STRIPE_SCRIPTS],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...storageOrigins, ...IMAGE_HOSTS],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...storageOrigins, ...(map ? [map] : []), 'https://api.stripe.com', ...(dev ? ['ws:'] : [])],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': STRIPE_FRAMES,
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    ...(dev ? {} : { 'upgrade-insecure-requests': [] }),
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...new Set(values)].join(' '))
    .join('; ');
}

export function securityHeaders(options: SecurityHeaderOptions): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(options) },
    // Older browsers that don't read CSP frame-ancestors.
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Nothing here uses the camera, microphone or location; Stripe's wallets need the Payment Request API.
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(self "https://js.stripe.com")',
    },
    ...(options.dev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
  ];
}
