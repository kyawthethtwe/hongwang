import { addMonths, availabilityRangeError, computeAvailability, MAX_AVAILABILITY_NIGHTS } from './availability';

const base = {
  from: '2026-12-01',
  to: '2026-12-08',
  today: '2026-11-15',
  advanceNoticeDays: 0,
  bookingWindowMonths: 12,
  basePrice: 120000,
  bookings: [],
  blocks: [],
  overrides: {},
};

describe('addMonths', () => {
  it('adds months and clamps to the month end', () => {
    expect(addMonths('2026-11-15', 1)).toBe('2026-12-15');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-12-31', 12)).toBe('2027-12-31');
  });
});

describe('computeAvailability', () => {
  it('prices every night with base or special price', () => {
    const { prices, unavailable } = computeAvailability({ ...base, overrides: { '2026-12-05': 150000 } });
    expect(Object.keys(prices)).toEqual(['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07']);
    expect(prices['2026-12-05']).toBe(150000);
    expect(prices['2026-12-01']).toBe(120000);
    expect(unavailable).toEqual([]);
  });

  it('marks booked nights [checkIn, checkOut) — the check-out day stays open', () => {
    const { unavailable } = computeAvailability({ ...base, bookings: [{ checkIn: '2026-12-03', checkOut: '2026-12-05' }] });
    expect(unavailable).toEqual(['2026-12-03', '2026-12-04']);
  });

  it('clips bookings that start before or end after the range', () => {
    const { unavailable } = computeAvailability({
      ...base,
      bookings: [
        { checkIn: '2026-11-28', checkOut: '2026-12-02' },
        { checkIn: '2026-12-07', checkOut: '2026-12-20' },
      ],
    });
    expect(unavailable).toEqual(['2026-12-01', '2026-12-07']);
  });

  it('marks host blocks', () => {
    expect(computeAvailability({ ...base, blocks: ['2026-12-06'] }).unavailable).toEqual(['2026-12-06']);
  });

  it('marks nights inside advance notice (including the past)', () => {
    const { unavailable } = computeAvailability({ ...base, from: '2026-11-13', to: '2026-11-18', advanceNoticeDays: 2 });
    expect(unavailable).toEqual(['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']);
  });

  it('allows same-day booking with no notice', () => {
    expect(computeAvailability({ ...base, from: '2026-11-15', to: '2026-11-16' }).unavailable).toEqual([]);
  });

  it('marks nights beyond the booking window', () => {
    const { unavailable } = computeAvailability({ ...base, from: '2027-02-13', to: '2027-02-17', bookingWindowMonths: 3 });
    expect(unavailable).toEqual(['2027-02-15', '2027-02-16']);
  });

  it('lists each night once and in order', () => {
    const { unavailable } = computeAvailability({
      ...base,
      blocks: ['2026-12-04', '2026-12-02'],
      bookings: [{ checkIn: '2026-12-02', checkOut: '2026-12-05' }],
    });
    expect(unavailable).toEqual(['2026-12-02', '2026-12-03', '2026-12-04']);
  });
});

describe('availabilityRangeError', () => {
  it('validates the range', () => {
    expect(availabilityRangeError('2026-12-01', '2026-12-01')).not.toBeNull();
    expect(availabilityRangeError('2026-12-05', '2026-12-01')).not.toBeNull();
    expect(availabilityRangeError('2026-12-01', '2027-02-01')).toBeNull();
    expect(availabilityRangeError('2026-01-01', '2027-12-01')).toContain(String(MAX_AVAILABILITY_NIGHTS));
  });
});
