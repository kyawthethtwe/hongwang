import { Inject, Injectable } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import type { GoogleProfile } from './google';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/**
 * Google OAuth 2.0 (authorization code flow) with plain fetch. Active only when GOOGLE_CLIENT_ID
 * and GOOGLE_CLIENT_SECRET are set. The redirect URI goes through the web origin
 * (WEB_ORIGIN/api/auth/google/callback, proxied to this API) so the session cookies are first-party.
 * Register that exact URI in the Google Cloud console.
 */
@Injectable()
export class GoogleOAuthService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  get enabled(): boolean {
    return !!this.env.GOOGLE_CLIENT_ID && !!this.env.GOOGLE_CLIENT_SECRET;
  }

  get redirectUri(): string {
    return `${this.env.WEB_ORIGIN.replace(/\/$/, '')}/api/auth/google/callback`;
  }

  authorizeUrl(state: string): string {
    const qs = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return `${AUTHORIZE_URL}?${qs.toString()}`;
  }

  /** Exchanges the code and reads the profile. Throws on any provider error. */
  async fetchProfile(code: string): Promise<GoogleProfile> {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        code,
        client_id: this.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: this.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) throw new Error(`Google token exchange failed (${tokenRes.status})`);
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) throw new Error('Google token response had no access_token');

    const infoRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!infoRes.ok) throw new Error(`Google userinfo failed (${infoRes.status})`);
    const info = (await infoRes.json()) as {
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      given_name?: string;
      family_name?: string;
      name?: string;
      picture?: string;
    };
    if (!info.sub) throw new Error('Google userinfo had no sub');
    return {
      sub: info.sub,
      email: info.email?.trim().toLowerCase() || null,
      emailVerified: info.email_verified === true || info.email_verified === 'true',
      givenName: info.given_name ?? null,
      familyName: info.family_name ?? null,
      name: info.name ?? null,
      picture: info.picture ?? null,
    };
  }
}
