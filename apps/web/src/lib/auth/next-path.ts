/**
 * The `?next=` to return to after signing in. Only same-site relative paths are allowed
 * ("/trips?x=1"), never "//evil.com", "/\evil.com" or absolute URLs. Returns null otherwise.
 */
export function safeNextPath(raw: string | string[] | null | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string' || v.length === 0 || v.length > 512) return null;
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null;
  if (/[\u0000-\u001f\\]/.test(v)) return null;
  // Never bounce back into the auth pages themselves.
  if (/^\/(login|reset-password|verify-email)(\/|\?|$)/.test(v)) return null;
  return v;
}

/** `/login?next=…` for a path, keeping its query. */
export function loginHref(next?: string | null, mode?: 'signin' | 'signup' | 'phone' | 'reset'): string {
  const qs = new URLSearchParams();
  if (mode && mode !== 'signin') qs.set('mode', mode);
  const safe = safeNextPath(next);
  if (safe && safe !== '/') qs.set('next', safe);
  const s = qs.toString();
  return s ? `/login?${s}` : '/login';
}
