import type { NextConfig } from 'next';
import { securityHeaders } from './src/lib/security-headers';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const headers = securityHeaders({
  dev: process.env.NODE_ENV !== 'production',
  mapStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron',
  // The API's local uploads by default; set the R2 endpoint and public bucket URL in staging and production.
  storageOrigins: (process.env.STORAGE_ORIGINS ?? 'http://localhost:4000').split(/\s+/).filter(Boolean),
});

const nextConfig: NextConfig = {
  transpilePackages: ['@hongwang/shared'],
  // The browser only talks to this origin; /api/* is proxied to the NestJS API, so the
  // httpOnly session cookies are first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
  // Every page except /api/*, whose responses carry the API's own headers (apps/api, helmet).
  async headers() {
    return [{ source: '/((?!api/).*)', headers }];
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '4000', pathname: '/uploads/**' },
      { protocol: 'http', hostname: 'localhost', port: '9000' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
