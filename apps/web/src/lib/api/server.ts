import 'server-only';
import axios from 'axios';
import { cookies } from 'next/headers';
import { ApiError, buildQuery, toApiError, type ApiFetchOptions } from './client';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * Server-side client. The `fetch` adapter calls Next.js's patched fetch and passes `fetchOptions`
 * through, so `revalidate` (Data Cache) and per-request de-duplication still apply.
 */
const server = axios.create({
  baseURL: `${API_URL}/api`,
  adapter: 'fetch',
  headers: { Accept: 'application/json' },
});

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
  const { method = 'GET', body, query, headers, signal, nullOn404, revalidate } = opts;
  const cookieHeader = (await cookies()).toString();
  try {
    const res = await server.request<T>({
      url: `${path}${buildQuery(query)}`,
      method,
      data: body,
      signal,
      headers: { ...(cookieHeader ? { Cookie: cookieHeader } : {}), ...headers },
      fetchOptions: revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' },
    });
    return (res.status === 204 ? undefined : res.data) as T;
  } catch (err) {
    if (nullOn404 && axios.isAxiosError(err) && err.response?.status === 404) return null as T;
    throw toApiError(err);
  }
}

export { ApiError };
