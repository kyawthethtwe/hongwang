import {
  classifyRefreshFailure,
  formatRefreshCookie,
  parseRefreshCookie,
  randomToken,
  REFRESH_REUSE_GRACE_MS,
  safeEqual,
  sha256,
} from './tokens';

const SID = '3f2b8c1e-6a4d-4e2f-9b7a-1c2d3e4f5a6b';

describe('refresh cookie value', () => {
  it('round-trips <sessionId>.<token>', () => {
    const token = randomToken();
    expect(token).toHaveLength(43);
    expect(parseRefreshCookie(formatRefreshCookie(SID, token))).toEqual({ sessionId: SID, token });
  });

  it('lower-cases the session id', () => {
    const token = randomToken();
    expect(parseRefreshCookie(`${SID.toUpperCase()}.${token}`)?.sessionId).toBe(SID);
  });

  it.each([
    ['undefined', undefined],
    ['a number', 42],
    ['empty', ''],
    ['no dot', SID],
    ['empty session id', `.${'a'.repeat(43)}`],
    ['not a uuid', `abc.${'a'.repeat(43)}`],
    ['short token', `${SID}.abc`],
    ['token with bad chars', `${SID}.${'a'.repeat(42)}=`],
    ['extra dot in token', `${SID}.${'a'.repeat(20)}.${'a'.repeat(22)}`],
    ['too long', `${SID}.${'a'.repeat(200)}`],
  ])('rejects %s', (_label, value) => {
    expect(parseRefreshCookie(value)).toBeNull();
  });
});

describe('hashing', () => {
  it('sha256 is hex and deterministic', () => {
    expect(sha256('x')).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256('x')).toBe(sha256('x'));
    expect(sha256('x')).not.toBe(sha256('y'));
  });

  it('safeEqual compares by value, including different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('randomToken is base64url and unique', () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(randomToken()).not.toBe(a);
  });
});

describe('classifyRefreshFailure', () => {
  const now = new Date('2026-12-01T10:00:00Z');
  const future = new Date('2026-12-30T10:00:00Z');
  const longAgo = new Date('2026-11-30T10:00:00Z');

  it('unknown session is invalid', () => {
    expect(classifyRefreshFailure(undefined, now)).toBe('invalid');
  });

  it('revoked and expired sessions are refused without further action', () => {
    expect(classifyRefreshFailure({ revokedAt: longAgo, expiresAt: future, lastUsedAt: longAgo }, now)).toBe('revoked');
    expect(classifyRefreshFailure({ revokedAt: null, expiresAt: now, lastUsedAt: longAgo }, now)).toBe('expired');
  });

  it('a just-rotated token is a tab race, not theft', () => {
    const justNow = new Date(now.getTime() - REFRESH_REUSE_GRACE_MS + 1000);
    expect(classifyRefreshFailure({ revokedAt: null, expiresAt: future, lastUsedAt: justNow }, now)).toBe('stale');
  });

  it('an old token for a live session is reuse', () => {
    expect(classifyRefreshFailure({ revokedAt: null, expiresAt: future, lastUsedAt: longAgo }, now)).toBe('reuse');
  });
});
