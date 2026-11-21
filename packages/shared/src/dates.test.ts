import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, eachNight, nightsBetween, rangesOverlap, toDateRangeLiteral, todayInBangkok } from './dates';

describe('stay date helpers', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts nights in [checkIn, checkOut) and lists each one', () => {
    expect(nightsBetween('2026-12-12', '2026-12-15')).toBe(3);
    expect(eachNight('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
    expect(eachNight('2026-12-12', '2026-12-12')).toEqual([]);
    expect(daysBetween('2026-12-15', '2026-12-12')).toBe(-3);
  });

  it('takes "today" in Bangkok (UTC+7), not on the server clock', () => {
    expect(todayInBangkok(new Date('2026-11-21T16:59:00Z'))).toBe('2026-11-21');
    expect(todayInBangkok(new Date('2026-11-21T17:00:00Z'))).toBe('2026-11-22');
  });

  it('treats back-to-back stays as not overlapping, like the Postgres [) daterange', () => {
    expect(rangesOverlap('2026-12-12', '2026-12-15', '2026-12-15', '2026-12-18')).toBe(false);
    expect(rangesOverlap('2026-12-12', '2026-12-15', '2026-12-14', '2026-12-18')).toBe(true);
    expect(toDateRangeLiteral('2026-12-12', '2026-12-15')).toBe('[2026-12-12,2026-12-15)');
  });
});
