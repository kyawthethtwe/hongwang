import { checkOtp, generateOtp, hashOtp, OTP_MAX_ATTEMPTS, otpErrorMessage, resendWaitSec } from './otp';

const SECRET = 'test-secret-test-secret-test-secret!';
const PHONE = '+66812345678';

describe('generateOtp', () => {
  it('is always 6 digits', () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
});

describe('hashOtp', () => {
  it('depends on the secret, the phone and the code', () => {
    const h = hashOtp(SECRET, PHONE, '123456');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtp(SECRET, PHONE, '123456')).toBe(h);
    expect(hashOtp(SECRET, PHONE, '123457')).not.toBe(h);
    expect(hashOtp(SECRET, '+66812345679', '123456')).not.toBe(h);
    expect(hashOtp(`${SECRET}x`, PHONE, '123456')).not.toBe(h);
  });
});

describe('resendWaitSec (45 s cooldown)', () => {
  const sent = new Date('2026-12-01T10:00:00Z');
  const at = (sec: number) => new Date(sent.getTime() + sec * 1000);

  it('allows the first code', () => {
    expect(resendWaitSec(undefined, sent)).toBe(0);
    expect(resendWaitSec(null, sent)).toBe(0);
  });

  it('counts down and rounds up', () => {
    expect(resendWaitSec(sent, at(0))).toBe(45);
    expect(resendWaitSec(sent, at(3))).toBe(42);
    expect(resendWaitSec(sent, at(44.2))).toBe(1);
    expect(resendWaitSec(sent, at(45))).toBe(0);
    expect(resendWaitSec(sent, at(600))).toBe(0);
  });
});

describe('checkOtp', () => {
  const now = new Date('2026-12-01T10:02:00Z');
  const good = hashOtp(SECRET, PHONE, '419273');
  const row = (over: Partial<Parameters<typeof checkOtp>[0]> = {}) => ({
    tokenHash: good,
    attempts: 1,
    expiresAt: new Date('2026-12-01T10:05:00Z'),
    consumedAt: null,
    ...over,
  });

  it('accepts the right code', () => {
    expect(checkOtp(row(), good, now)).toEqual({ status: 'ok' });
    expect(checkOtp(row({ attempts: OTP_MAX_ATTEMPTS }), good, now)).toEqual({ status: 'ok' });
  });

  it('reports tries left on a wrong code', () => {
    const bad = hashOtp(SECRET, PHONE, '000000');
    expect(checkOtp(row({ attempts: 1 }), bad, now)).toEqual({ status: 'mismatch', attemptsLeft: 4 });
    expect(checkOtp(row({ attempts: 5 }), bad, now)).toEqual({ status: 'mismatch', attemptsLeft: 0 });
  });

  it('locks after 5 attempts, even for the right code', () => {
    expect(checkOtp(row({ attempts: OTP_MAX_ATTEMPTS + 1 }), good, now)).toEqual({ status: 'locked' });
  });

  it('refuses expired and used codes first', () => {
    expect(checkOtp(row({ expiresAt: now }), good, now)).toEqual({ status: 'expired' });
    expect(checkOtp(row({ consumedAt: now }), good, now)).toEqual({ status: 'consumed' });
  });

  it('has a message for every failure', () => {
    expect(otpErrorMessage({ status: 'mismatch', attemptsLeft: 1 })).toContain('1 try left');
    expect(otpErrorMessage({ status: 'mismatch', attemptsLeft: 3 })).toContain('3 tries left');
    expect(otpErrorMessage({ status: 'mismatch', attemptsLeft: 0 })).toContain('Ask for a new code');
    expect(otpErrorMessage({ status: 'locked' })).toMatch(/too many/i);
    expect(otpErrorMessage({ status: 'expired' })).toMatch(/expired/);
  });
});
