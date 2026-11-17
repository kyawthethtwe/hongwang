import {
  buildCalendarDays,
  buildDayStates,
  dateRange,
  monthDates,
  nightsHeldByBookings,
  shortName,
  stayState,
  uniqueSorted,
  type StayLike,
} from './day-states';

const stay = (over: Partial<StayLike> & Pick<StayLike, 'checkIn' | 'checkOut'>): StayLike => ({
  id: over.id ?? `b-${over.checkIn}`,
  status: 'confirmed',
  guestName: 'Daniel M.',
  ...over,
});

describe('date helpers', () => {
  it('builds ranges and months', () => {
    expect(dateRange('2026-12-30', 4)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(monthDates('2026-02')).toHaveLength(28);
    expect(monthDates('2028-02')).toHaveLength(29);
    expect(monthDates('2026-12').at(-1)).toBe('2026-12-31');
    expect(uniqueSorted(['2026-12-03', '2026-12-01', '2026-12-03'])).toEqual(['2026-12-01', '2026-12-03']);
  });

  it('maps statuses to states', () => {
    expect(stayState('confirmed')).toBe('booked');
    expect(stayState('completed')).toBe('booked');
    expect(stayState('payment_hold')).toBe('payment_hold');
    expect(stayState('requested')).toBe('requested');
    expect(stayState('cancelled')).toBeNull();
    expect(stayState('rejected')).toBeNull();
    expect(stayState('expired')).toBeNull();
  });

  it('shortens names', () => {
    expect(shortName('Daniel', 'Morris')).toBe('Daniel M.');
    expect(shortName('Nok', '')).toBe('Nok');
  });
});

describe('buildDayStates', () => {
  const dates = dateRange('2026-12-10', 6); // 10..15

  it('is open with nothing on the calendar', () => {
    const out = buildDayStates(dates, [], []);
    expect(out.map((d) => d.state)).toEqual(['open', 'open', 'open', 'open', 'open', 'open']);
    expect(out.every((d) => d.bookingId === null && !d.isBookingStart)).toBe(true);
  });

  it('marks booking nights as half-open [checkIn, checkOut) with the label on the first night', () => {
    const out = buildDayStates(dates, [stay({ id: 'b1', checkIn: '2026-12-11', checkOut: '2026-12-14' })], []);
    expect(out.map((d) => d.state)).toEqual(['open', 'booked', 'booked', 'booked', 'open', 'open']);
    expect(out.map((d) => d.isBookingStart)).toEqual([false, true, false, false, false, false]);
    expect(out[2]).toMatchObject({ bookingId: 'b1', guestName: 'Daniel M.' });
  });

  it('labels a booking that started before the range on the first visible night', () => {
    const out = buildDayStates(dates, [stay({ id: 'b1', checkIn: '2026-12-08', checkOut: '2026-12-12' })], []);
    expect(out.map((d) => d.isBookingStart)).toEqual([true, false, false, false, false, false]);
  });

  it('starts a new label when one stay ends and the next begins the same day', () => {
    const out = buildDayStates(
      dates,
      [
        stay({ id: 'a', checkIn: '2026-12-10', checkOut: '2026-12-12' }),
        stay({ id: 'b', checkIn: '2026-12-12', checkOut: '2026-12-14', guestName: 'Hana K.' }),
      ],
      [],
    );
    expect(out.map((d) => d.bookingId)).toEqual(['a', 'a', 'b', 'b', null, null]);
    expect(out.map((d) => d.isBookingStart)).toEqual([true, false, true, false, false, false]);
  });

  it('applies the priority booked > payment_hold > blocked > requested > open', () => {
    const out = buildDayStates(
      dates,
      [
        stay({ id: 'req', status: 'requested', checkIn: '2026-12-10', checkOut: '2026-12-16' }),
        stay({ id: 'hold', status: 'payment_hold', checkIn: '2026-12-12', checkOut: '2026-12-14' }),
        stay({ id: 'done', status: 'completed', checkIn: '2026-12-13', checkOut: '2026-12-14' }),
      ],
      ['2026-12-11', '2026-12-12', '2026-12-15'],
    );
    expect(out.map((d) => d.state)).toEqual(['requested', 'blocked', 'payment_hold', 'booked', 'requested', 'blocked']);
    expect(out.map((d) => d.bookingId)).toEqual(['req', null, 'hold', 'done', 'req', null]);
  });

  it('ignores cancelled, rejected and expired bookings', () => {
    const out = buildDayStates(
      dates,
      [
        stay({ status: 'cancelled', checkIn: '2026-12-10', checkOut: '2026-12-12' }),
        stay({ status: 'rejected', checkIn: '2026-12-12', checkOut: '2026-12-13' }),
        stay({ status: 'expired', checkIn: '2026-12-13', checkOut: '2026-12-14' }),
      ],
      [],
    );
    expect(out.every((d) => d.state === 'open')).toBe(true);
  });
});

describe('buildCalendarDays', () => {
  it('returns every day with price, special flag and past flag', () => {
    const days = buildCalendarDays({
      month: '2026-12',
      today: '2026-12-10',
      basePrice: 120000,
      overrides: { '2026-12-31': 240000 },
      blocked: ['2026-12-18'],
      stays: [stay({ id: 'h', status: 'payment_hold', checkIn: '2026-12-12', checkOut: '2026-12-15' })],
    });
    expect(days).toHaveLength(31);
    expect(days[0]).toMatchObject({ date: '2026-12-01', state: 'open', price: 120000, isSpecialPrice: false, isPast: true });
    expect(days[9]).toMatchObject({ date: '2026-12-10', isPast: false });
    expect(days[11]).toMatchObject({ state: 'payment_hold', bookingId: 'h', isBookingStart: true });
    expect(days[13]).toMatchObject({ state: 'payment_hold', isBookingStart: false });
    expect(days[14]).toMatchObject({ date: '2026-12-15', state: 'open' });
    expect(days[17]).toMatchObject({ state: 'blocked', bookingId: null });
    expect(days[30]).toMatchObject({ price: 240000, isSpecialPrice: true });
  });
});

describe('nightsHeldByBookings', () => {
  it('finds nights taken by date-holding bookings only', () => {
    const held = nightsHeldByBookings(
      ['2026-12-11', '2026-12-12', '2026-12-14', '2026-12-20'],
      [
        { status: 'confirmed', checkIn: '2026-12-11', checkOut: '2026-12-14' },
        { status: 'requested', checkIn: '2026-12-20', checkOut: '2026-12-22' },
        { status: 'cancelled', checkIn: '2026-12-14', checkOut: '2026-12-15' },
      ],
    );
    expect(held).toEqual(['2026-12-11', '2026-12-12']);
  });

  it('treats payment holds and completed stays as holding', () => {
    expect(
      nightsHeldByBookings(['2026-12-01', '2026-12-05'], [
        { status: 'payment_hold', checkIn: '2026-12-01', checkOut: '2026-12-02' },
        { status: 'completed', checkIn: '2026-12-04', checkOut: '2026-12-06' },
      ]),
    ).toEqual(['2026-12-01', '2026-12-05']);
  });
});
