import { formatOauthState, googleNames, parseOauthState, resolveGoogleLink } from './google';
import { safeNextPath } from './request-meta';

describe('Google state cookie', () => {
  const state = 'abcdefghijklmnopqrstuvwx';

  it('round-trips state, mode and next', () => {
    const v = formatOauthState({ state, connect: true, next: '/account?section=security' });
    expect(parseOauthState(v)).toEqual({ state, connect: true, next: '/account?section=security' });
    expect(parseOauthState(formatOauthState({ state, connect: false, next: '/' }))).toEqual({ state, connect: false, next: '/' });
  });

  it('never yields an off-site next', () => {
    const v = `${state}.s.${Buffer.from('//evil.example').toString('base64url')}`;
    expect(parseOauthState(v)?.next).toBe('/');
  });

  it.each([undefined, '', 'short.s.Lw', `${'a'.repeat(20)}.x.Lw`, `${'a'.repeat(20)}.s`, `${'a'.repeat(20)}.s.Lw.extra`])(
    'rejects %p',
    (v) => expect(parseOauthState(v)).toBeNull(),
  );
});

describe('safeNextPath', () => {
  it.each([
    ['/trips', '/trips'],
    ['/rooms/1?checkIn=2026-12-12', '/rooms/1?checkIn=2026-12-12'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['https://evil.com', '/'],
    ['trips', '/'],
    [undefined, '/'],
    ['/a\nb', '/'],
  ])('%p -> %p', (input, out) => expect(safeNextPath(input)).toBe(out));
});

describe('resolveGoogleLink', () => {
  const verified = { email: 'ploy@example.com', emailVerified: true };
  const unverified = { email: 'ploy@example.com', emailVerified: false };
  const A = { id: 'user-a' };
  const B = { id: 'user-b' };

  it('signs in the account already linked to the Google id', () => {
    expect(resolveGoogleLink(verified, A, B)).toEqual({ action: 'signin', userId: 'user-a' });
  });

  it('links an existing account by verified email only', () => {
    expect(resolveGoogleLink(verified, null, B)).toEqual({ action: 'link', userId: 'user-b' });
    expect(resolveGoogleLink(unverified, null, B)).toEqual({ action: 'error', error: 'google_email_unverified' });
  });

  it('creates an account when nothing matches', () => {
    expect(resolveGoogleLink(unverified, null, null)).toEqual({ action: 'create' });
    expect(resolveGoogleLink({ email: null, emailVerified: false }, null, null)).toEqual({ action: 'error', error: 'google' });
  });

  it('connect mode links to the caller, unless the Google id belongs to someone else', () => {
    expect(resolveGoogleLink(verified, null, B, 'user-a')).toEqual({ action: 'link', userId: 'user-a' });
    expect(resolveGoogleLink(verified, A, null, 'user-a')).toEqual({ action: 'signin', userId: 'user-a' });
    expect(resolveGoogleLink(verified, B, null, 'user-a')).toEqual({ action: 'error', error: 'google_in_use' });
  });
});

describe('googleNames', () => {
  it('prefers given/family name, then full name, then the email', () => {
    expect(googleNames({ givenName: 'Ploy', familyName: 'Kittisak', name: null, email: null })).toEqual({ firstName: 'Ploy', lastName: 'Kittisak' });
    expect(googleNames({ givenName: null, familyName: null, name: 'Krit Wongsa', email: null })).toEqual({ firstName: 'Krit', lastName: '' });
    expect(googleNames({ givenName: null, familyName: null, name: null, email: 'nok@example.com' })).toEqual({ firstName: 'nok', lastName: '' });
  });
});
