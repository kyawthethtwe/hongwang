import type { ApiErrorBody } from '@hongwang/shared';
import axios, { type InternalAxiosRequestConfig, type Method } from 'axios';

/** Thrown by apiFetch and serverFetch for every non-2xx response. `code` is the API's stable error code. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export interface ApiFetchOptions {
  method?: Method;
  /** Sent as JSON. */
  body?: unknown;
  query?: Query;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/** `?a=1&tags=x,y`: empty values dropped, arrays comma-joined (what the API's zod query schemas expect). */
export function buildQuery(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

const NETWORK_MESSAGE = 'We couldn’t reach Hongwang. Check your connection and try again.';

/**
 * Turns an axios failure into ApiError (status, the API's `code`, `message`, `details`). A request
 * that never got a response becomes status 0 / NETWORK_ERROR. Cancellations pass through unchanged
 * so TanStack Query recognises them.
 */
export function toApiError(err: unknown): unknown {
  if (!axios.isAxiosError(err) || axios.isCancel(err)) return err;
  if (!err.response) return new ApiError(0, 'NETWORK_ERROR', NETWORK_MESSAGE);
  const { status, statusText, data } = err.response;
  const body = (data && typeof data === 'object' ? data : {}) as Partial<ApiErrorBody>;
  return new ApiError(status, body.code ?? `HTTP_${status}`, body.message ?? (statusText || `Request failed (${status})`), body.details);
}

/** Browser client: same origin through the Next.js /api rewrite, so the session cookies go along. */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time per tab (shared by apiFetch and useSession). */
export async function tryRefresh(): Promise<boolean> {
  refreshing ??= api
    .post('/auth/refresh')
    .then(
      () => true,
      () => false,
    )
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// On 401 (expired access token), refresh the session once and replay the request. Auth endpoints
// are never replayed: their 401s mean "signed out" and useSession handles them.
api.interceptors.response.use(undefined, async (err: unknown) => {
  if (axios.isAxiosError(err) && err.response?.status === 401) {
    const config = err.config as RetriableConfig | undefined;
    if (config && !config._retried && !config.url?.startsWith('/auth/')) {
      config._retried = true;
      if (await tryRefresh()) return api.request(config);
    }
  }
  throw toApiError(err);
});

/**
 * Browser-side call to the API. Throws ApiError on failure; on 401 it refreshes the session once
 * and retries.
 *
 *   const listing = await apiFetch<ListingDetailDto>(`/listings/${id}`);
 *   await apiFetch('/bookings', { method: 'POST', body: input });
 */
export async function apiFetch<T = void>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, query, headers, signal } = opts;
  const res = await api.request<T>({ url: `${path}${buildQuery(query)}`, method, data: body, headers, signal });
  return (res.status === 204 ? undefined : res.data) as T;
}

/** Human message for toasts. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Zod issues from a VALIDATION_FAILED error, keyed by field path, for react-hook-form setError. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !Array.isArray(err.details)) return {};
  const out: Record<string, string> = {};
  for (const issue of err.details as { path?: (string | number)[]; message?: string }[]) {
    if (issue.path?.length && issue.message) out[issue.path.join('.')] = issue.message;
  }
  return out;
}
