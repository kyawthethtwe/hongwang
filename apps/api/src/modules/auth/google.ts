import type { GoogleAuthError } from '@hongwang/shared';
import { safeNextPath } from './request-meta';

/** Pure parts of Google sign-in: the state cookie and how a Google profile maps to an account. */

export interface GoogleProfile {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
  name: string | null;
  picture: string | null;
}

export interface OauthState {
  state: string;
  next: string;
  /** Link Google to the signed-in account instead of signing in. */
  connect: boolean;
}

/** Cookie value `<state>.<c|s>.<base64url(next)>`. */
export function formatOauthState(s: OauthState): string {
  return `${s.state}.${s.connect ? 'c' : 's'}.${Buffer.from(s.next).toString('base64url')}`;
}

export function parseOauthState(value: unknown): OauthState | null {
  if (typeof value !== 'string' || value.length > 1024) return null;
  const [state, mode, next, ...rest] = value.split('.');
  if (rest.length || !state || !/^[A-Za-z0-9_-]{16,}$/.test(state) || (mode !== 'c' && mode !== 's') || next === undefined) {
    return null;
  }
  let decoded: string;
  try {
    decoded = Buffer.from(next, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  return { state, connect: mode === 'c', next: safeNextPath(decoded) };
}

type Candidate = { id: string } | null;

export type GoogleLinkDecision =
  | { action: 'signin'; userId: string }
  | { action: 'link'; userId: string }
  | { action: 'create' }
  | { action: 'error'; error: GoogleAuthError };

/**
 * byGoogleId: the account already linked to this Google id. byEmail: the account using the Google
 * email. currentUserId: set when a signed-in user is connecting Google from /account.
 */
export function resolveGoogleLink(
  profile: Pick<GoogleProfile, 'email' | 'emailVerified'>,
  byGoogleId: Candidate,
  byEmail: Candidate,
  currentUserId?: string,
): GoogleLinkDecision {
  if (currentUserId) {
    if (byGoogleId && byGoogleId.id !== currentUserId) return { action: 'error', error: 'google_in_use' };
    if (byGoogleId) return { action: 'signin', userId: currentUserId };
    return { action: 'link', userId: currentUserId };
  }
  if (byGoogleId) return { action: 'signin', userId: byGoogleId.id };
  if (byEmail) {
    // Only a verified Google email proves the person owns the existing account.
    return profile.emailVerified ? { action: 'link', userId: byEmail.id } : { action: 'error', error: 'google_email_unverified' };
  }
  if (!profile.email) return { action: 'error', error: 'google' };
  return { action: 'create' };
}

/** First/last name for a new account from the Google profile. */
export function googleNames(p: Pick<GoogleProfile, 'givenName' | 'familyName' | 'name' | 'email'>): {
  firstName: string;
  lastName: string;
} {
  const first = p.givenName?.trim() || p.name?.trim().split(/\s+/)[0] || p.email?.split('@')[0] || 'Guest';
  const last = p.familyName?.trim() || '';
  return { firstName: first.slice(0, 60), lastName: last.slice(0, 60) };
}
