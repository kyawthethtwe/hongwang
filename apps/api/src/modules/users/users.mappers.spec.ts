import { describeDevice } from './device';
import { toMeDto, toSessionDto, type UserRow } from './users.mappers';

const created = new Date('2026-01-02T03:04:05Z');

function userRow(over: Partial<UserRow> = {}): UserRow {
  return {
    id: 'u1',
    email: 'daniel@example.com',
    passwordHash: '$argon2id$v=19$...',
    firstName: 'Daniel',
    lastName: 'Morris',
    phone: '+66812345678',
    emailVerifiedAt: created,
    phoneVerifiedAt: null,
    googleId: null,
    avatarUrl: null,
    about: 'Quiet guest',
    role: 'user',
    kycStatus: 'none',
    hostProfile: null,
    stripeAccountId: null,
    stripeCustomerId: null,
    lineOptIn: false,
    locale: 'en',
    currency: 'THB',
    timezone: 'Asia/Bangkok',
    passwordChangedAt: created,
    suspendedAt: null,
    deletedAt: null,
    createdAt: created,
    updatedAt: created,
    ...over,
  };
}

describe('toMeDto', () => {
  it('maps the row and never leaks hashes or provider ids', () => {
    const dto = toMeDto(userRow({ googleId: 'g-123', stripeCustomerId: 'cus_1' }), { isHost: true });
    expect(dto).toEqual({
      id: 'u1',
      email: 'daniel@example.com',
      firstName: 'Daniel',
      lastName: 'Morris',
      phone: '+66812345678',
      emailVerified: true,
      phoneVerified: false,
      avatarUrl: null,
      about: 'Quiet guest',
      role: 'user',
      kycStatus: 'none',
      isHost: true,
      locale: 'en',
      currency: 'THB',
      timezone: 'Asia/Bangkok',
      hasPassword: true,
      passwordChangedAt: created.toISOString(),
      googleConnected: true,
      createdAt: created.toISOString(),
    });
    expect(JSON.stringify(dto)).not.toMatch(/argon2|g-123|cus_1/);
  });

  it('phone or Google accounts have no password', () => {
    const dto = toMeDto(userRow({ passwordHash: null, email: null, emailVerifiedAt: null, phoneVerifiedAt: created }), { isHost: false });
    expect(dto.hasPassword).toBe(false);
    expect(dto.passwordChangedAt).toBeNull();
    expect(dto.emailVerified).toBe(false);
    expect(dto.phoneVerified).toBe(true);
    expect(dto.isHost).toBe(false);
  });
});

describe('toSessionDto', () => {
  const row = {
    id: 's1',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    ip: '1.2.3.4',
    lastUsedAt: created,
    createdAt: created,
  };

  it('flags the current session and describes the device', () => {
    expect(toSessionDto(row, 's1')).toEqual({
      id: 's1',
      device: 'Chrome on macOS',
      ip: '1.2.3.4',
      lastUsedAt: created.toISOString(),
      createdAt: created.toISOString(),
      current: true,
    });
    expect(toSessionDto(row, 's2').current).toBe(false);
    expect(toSessionDto(row, undefined).current).toBe(false);
  });
});

describe('describeDevice', () => {
  it.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Chrome on macOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      'Safari on iPhone',
    ],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox on Windows'],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      'Chrome on Android',
    ],
  ])('%s', (ua, expected) => expect(describeDevice(ua)).toBe(expected));

  it('falls back for missing or unknown agents', () => {
    expect(describeDevice(null)).toBe('Unknown device');
    expect(describeDevice('')).toBe('Unknown device');
    expect(describeDevice('???')).toBe('Unknown device');
  });
});
