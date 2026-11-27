import { describe, expect, it } from 'vitest';
import { nextRange, rangeHasUnavailable, type DateRange } from './range';

const empty: DateRange = { checkIn: null, checkOut: null };
const unavailable = (...nights: string[]) => (night: string) => nights.includes(night);

describe('nextRange (date picker clicks)', () => {
  it('first click sets check-in, a later click sets check-out', () => {
    const start = nextRange(empty, '2026-12-12');
    expect(start).toEqual({ checkIn: '2026-12-12', checkOut: null });
    expect(nextRange(start!, '2026-12-15')).toEqual({ checkIn: '2026-12-12', checkOut: '2026-12-15' });
  });

  it('a click on or before check-in starts again from that day', () => {
    const start = { checkIn: '2026-12-12', checkOut: null };
    expect(nextRange(start, '2026-12-10')).toEqual({ checkIn: '2026-12-10', checkOut: null });
    expect(nextRange(start, '2026-12-12')).toEqual({ checkIn: '2026-12-12', checkOut: null });
  });

  it('a click after a complete range starts a new one', () => {
    expect(nextRange({ checkIn: '2026-12-12', checkOut: '2026-12-15' }, '2026-12-20')).toEqual({ checkIn: '2026-12-20', checkOut: null });
  });

  it('ignores a check-in on an unavailable night', () => {
    expect(nextRange(empty, '2026-12-12', unavailable('2026-12-12'))).toBeNull();
  });

  it('allows an unavailable night as the check-out day (nobody sleeps there)', () => {
    const isUnavailable = unavailable('2026-12-15');
    expect(nextRange({ checkIn: '2026-12-12', checkOut: null }, '2026-12-15', isUnavailable)).toEqual({
      checkIn: '2026-12-12',
      checkOut: '2026-12-15',
    });
  });

  it('restarts at the clicked day when the range would cross an unavailable night', () => {
    const isUnavailable = unavailable('2026-12-13');
    expect(nextRange({ checkIn: '2026-12-12', checkOut: null }, '2026-12-16', isUnavailable)).toEqual({
      checkIn: '2026-12-16',
      checkOut: null,
    });
  });
});

describe('rangeHasUnavailable', () => {
  it('checks the nights [checkIn, checkOut) only', () => {
    const r = { checkIn: '2026-12-12', checkOut: '2026-12-15' };
    expect(rangeHasUnavailable(r, unavailable('2026-12-14'))).toBe(true);
    expect(rangeHasUnavailable(r, unavailable('2026-12-15'))).toBe(false);
    expect(rangeHasUnavailable({ checkIn: '2026-12-12', checkOut: null }, unavailable('2026-12-12'))).toBe(false);
  });
});
