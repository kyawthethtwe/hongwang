import 'server-only';
import { cookies } from 'next/headers';
import { ApiError, buildQuery, parseResponse, type ApiFetchOptions } from './client';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * Server Component / Route Handler call to the API, forwarding the visitor's cookies.
 * Use for SSR pages (listing detail, search results). Returns null on 404 when `nullOn404`.
 *
 *   const listing = await serverFetch<ListingDetailDto>(`/listings/${id}`, { nullOn404: true });
 */
export async function serverFetch<T>(
  path: string,
  opts: ApiFetchOptions & { nullOn404?: boolean; revalidate?: number } = {},
): Promise<T> {
  const { body, query, headers, nullOn404, revalidate, ...rest } = opts;
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API_URL}/api${path}${buildQuery(query)}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...(revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' }),
  });
  if (nullOn404 && res.status === 404) return null as T;
  return parseResponse<T>(res);
}

export { ApiError };
