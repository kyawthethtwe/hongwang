import { AUTH_COOKIES } from '@hongwang/shared';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Optimistic sign-in check (Next 16 Proxy, formerly middleware): signed-out visitors to private
 * pages go to /login?next=<path>. It only looks for the session cookies; the API still checks
 * every request. hw_at outlives its JWT on purpose (see apps/api/src/modules/auth/cookies.ts), so
 * an expired access token still counts and the page refreshes the session itself.
 */
export function proxy(request: NextRequest) {
  const { cookies, nextUrl } = request;
  if (cookies.has(AUTH_COOKIES.access) || cookies.has(AUTH_COOKIES.refresh)) return NextResponse.next();

  const url = nextUrl.clone();
  url.pathname = '/login';
  url.search = new URLSearchParams({ next: `${nextUrl.pathname}${nextUrl.search}` }).toString();
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/trips/:path*',
    '/saved/:path*',
    '/account/:path*',
    '/host/:path*',
    '/checkout/:path*',
    '/inbox/:path*',
    '/admin/:path*',
  ],
};
