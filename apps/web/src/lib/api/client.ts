import type { ApiErrorBody } from '@hongwang/shared';

/** Thrown by apiFetch for every non-2xx response. `code` is the API's stable error code. */
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

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Query;
}

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

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time per tab (shared by apiFetch and useSession). */
export async function tryRefresh(): Promise<boolean> {
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

/**
 * Browser-side call to the API through the Next.js /api rewrite (same origin, cookies included).
 * On 401 it refreshes the session once and retries.
 *
 *   const listing = await apiFetch<ListingDetailDto>(`/listings/${id}`);
 *   await apiFetch('/bookings', { method: 'POST', body: input });
 */
export async function apiFetch<T = void>(path: string, opts: ApiFetchOptions = {}, retried = false): Promise<T> {
  const { body, query, headers, ...rest } = opts;
  const res = await fetch(`/api${path}${buildQuery(query)}`, {
    ...rest,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return apiFetch<T>(path, opts, true);
  }
  return parseResponse<T>(res);
}

export async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const e = (data ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(res.status, e.code ?? `HTTP_${res.status}`, e.message ?? res.statusText, e.details);
  }
  return data as T;
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
