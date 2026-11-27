import { describe, expect, it } from 'vitest';
import { countdown, formatDay, formatStay, formatStayShort, formatTHB, nightsLabel, pluralize } from './format';

describe('money', () => {
  it('formats satang as baht, with decimals only when there are any', () => {
    expect(formatTHB(429000)).toBe('฿4,290');
    expect(formatTHB(12345)).toBe('฿123.45');
    expect(formatTHB(0)).toBe('฿0');
    expect(formatTHB(123456789)).toBe('฿1,234,567.89');
  });

  it('uses a real minus for negatives and an optional plus', () => {
    expect(formatTHB(-30000)).toBe('−฿300');
    expect(formatTHB(30000, { sign: true })).toBe('+฿300');
    expect(formatTHB(0, { sign: true })).toBe('฿0');
  });
});

describe('dates', () => {
  it('formats days and stays', () => {
    expect(formatDay('2026-12-12')).toBe('Sat, Dec 12');
    expect(formatStay('2026-12-12', '2026-12-15')).toBe('Sat, Dec 12 – Tue, Dec 15');
    expect(formatStayShort('2026-12-12', '2026-12-15')).toBe('Dec 12 – 15');
    expect(formatStayShort('2026-12-30', '2027-01-02')).toBe('Dec 30 – Jan 2');
  });

  it('counts nights and pluralizes', () => {
    expect(nightsLabel('2026-12-12', '2026-12-13')).toBe('1 night');
    expect(nightsLabel('2026-12-12', '2026-12-15')).toBe('3 nights');
    expect(pluralize(1, 'guest')).toBe('1 guest');
    expect(pluralize(3, 'guest')).toBe('3 guests');
    expect(pluralize(2, 'person', 'people')).toBe('2 people');
  });

  it('counts down to the end of a payment hold', () => {
    const now = Date.parse('2026-12-10T07:00:00Z');
    expect(countdown('2026-12-10T07:14:05Z', now)).toBe('14:05');
    expect(countdown('2026-12-10T06:59:00Z', now)).toBe('0:00');
  });
});
