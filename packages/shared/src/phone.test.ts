import { describe, expect, it } from 'vitest';
import { formatPhone, isE164Mobile, mobilePhoneSchema, toE164Mobile } from './phone';

describe('toE164Mobile', () => {
  it('reads local and international ways of writing a Thai mobile', () => {
    for (const input of ['081 234 5678', '0812345678', '81-234-5678', '+66 81 234 5678', '+66812345678']) {
      expect(toE164Mobile(input, 'TH')).toBe('+66812345678');
    }
  });

  it('handles the other countries in the sign-in picker', () => {
    expect(toE164Mobile('09 212 3456', 'MM')).toBe('+9592123456');
    expect(toE164Mobile('012-345 6789', 'MY')).toBe('+60123456789');
  });

  it('refuses landlines, wrong lengths and junk, since codes go by SMS', () => {
    expect(toE164Mobile('02 123 4567', 'TH')).toBeNull(); // Bangkok landline
    expect(toE164Mobile('081 234 567', 'TH')).toBeNull();
    expect(toE164Mobile('9 123 456 789', 'MM')).toBeNull(); // the old placeholder; not a real range
    expect(toE164Mobile('hello', 'TH')).toBeNull();
    expect(toE164Mobile('0812345678')).toBeNull(); // no country to read a local number against
  });
});

describe('isE164Mobile / mobilePhoneSchema', () => {
  it('accepts only valid mobiles already in E.164', () => {
    expect(isE164Mobile('+66812345678')).toBe(true);
    expect(isE164Mobile('+66 81 234 5678')).toBe(false);
    expect(isE164Mobile('0812345678')).toBe(false);
    expect(isE164Mobile('+6621234567')).toBe(false);
    expect(mobilePhoneSchema.safeParse('+66812345678').success).toBe(true);
    expect(mobilePhoneSchema.safeParse('+6621234567').success).toBe(false); // right shape, landline
  });
});

describe('formatPhone', () => {
  it('groups digits the way each country writes them', () => {
    expect(formatPhone('+66812345678')).toBe('+66 81 234 5678');
    expect(formatPhone('+60123456789')).toBe('+60 12 345 6789');
    expect(formatPhone('not a number')).toBe('not a number');
  });
});
