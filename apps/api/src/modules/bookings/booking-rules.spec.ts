import { quoteStay, type BookingStatus } from '@hongwang/shared';
import { addMonths, bookingTab, refundFor, stayRuleViolations, type CancellableBooking, type StayRules } from './booking-rules';

const rules: StayRules = { minNights: 2, maxNights: 30, maxGuests: 2, advanceNoticeDays: 1, bookingWindowMonths: 3 };
const today = '2026-12-01';

describe('stayRuleViolations', () => {
  it('accepts a stay inside every rule', () => {
    expect(stayRuleViolations(rules, { checkIn: '2026-12-12', checkOut: '2026-12-15', guests: 2 }, today)).toEqual([]);
  });

  it('flags min and max nights', () => {
    expect(stayRuleViolations(rules, { checkIn: '2026-12-12', checkOut: '2026-12-13', guests: 1 }, today)).toEqual(['min_nights']);
    expect(stayRuleViolations(rules, { checkIn: '2026-12-02', checkOut: '2027-01-02', guests: 1 }, today)).toEqual(['max_nights']);
  });

  it('flags too many guests', () => {
    expect(stayRuleViolations(rules, { checkIn: '2026-12-12', checkOut: '2026-12-15', guests: 3 }, today)).toEqual(['max_guests']);
  });

  it('flags check-in inside the advance notice (and in the past)', () => {
    expect(stayRuleViolations(rules, { checkIn: '2026-12-01', checkOut: '2026-12-04', guests: 1 }, today)).toEqual(['advance_notice']);
    expect(stayRuleViolations(rules, { checkIn: '2026-12-02', checkOut: '2026-12-04', guests: 1 }, today)).toEqual([]);
    expect(
      stayRuleViolations({ ...rules, advanceNoticeDays: 0 }, { checkIn: '2026-11-30', checkOut: '2026-12-04', guests: 1 }, today),
    ).toEqual(['advance_notice']);
    expect(
      stayRuleViolations({ ...rules, advanceNoticeDays: 0 }, { checkIn: today, checkOut: '2026-12-04', guests: 1 }, today),
    ).toEqual([]);
  });

  it('flags nights beyond the booking window', () => {
    // window ends 2027-03-01: the last night may be Feb 28
    expect(stayRuleViolations(rules, { checkIn: '2027-02-27', checkOut: '2027-03-01', guests: 1 }, today)).toEqual([]);
    expect(stayRuleViolations(rules, { checkIn: '2027-02-28', checkOut: '2027-03-02', guests: 1 }, today)).toEqual(['booking_window']);
  });
});

describe('addMonths', () => {
  it('adds calendar months and clamps to the month end', () => {
    expect(addMonths('2026-12-01', 3)).toBe('2027-03-01');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 12)).toBe('2027-11-15');
  });
});

describe('bookingTab', () => {
  const cases: [BookingStatus, string, string | null][] = [
    ['requested', '2026-12-05', 'upcoming'],
    ['payment_hold', '2026-12-01', 'upcoming'], // checks out today: still upcoming
    ['confirmed', '2026-12-05', 'upcoming'],
    ['confirmed', '2026-11-30', 'past'], // stay over, not completed yet
    ['completed', '2026-11-30', 'past'],
    ['cancelled', '2026-12-05', 'cancelled'],
    ['rejected', '2026-12-05', 'cancelled'],
    ['expired', '2026-11-01', 'cancelled'],
    ['requested', '2026-11-30', null],
  ];
  it.each(cases)('%s checking out %s -> %s', (status, checkOut, tab) => {
    expect(bookingTab(status, checkOut, today)).toBe(tab);
  });
});

describe('refundFor', () => {
  const q = quoteStay({ checkIn: '2026-12-12', checkOut: '2026-12-15', basePrice: 120000, cleaningFee: 30000 });
  const booking = (status: BookingStatus): CancellableBooking => ({
    status,
    cancellationPolicy: 'moderate',
    checkIn: '2026-12-12',
    nightsTotal: q.nightsTotal,
    cleaningFee: q.cleaningFee,
    serviceFee: q.serviceFee,
    total: q.total,
    hostPayout: q.hostPayout,
  });

  it('refunds nothing before payment, whoever cancels', () => {
    for (const status of ['requested', 'payment_hold'] as const) {
      const r = refundFor(booking(status), 'guest', '2026-12-11');
      expect(r.refundTotal).toBe(0);
      expect(r.hostPenalty).toBe(0);
      expect(r.lines.every((l) => l.paid === 0)).toBe(true);
    }
  });

  it('applies the policy when the guest cancels a confirmed stay (design B2: ฿2,100 back)', () => {
    expect(refundFor(booking('confirmed'), 'guest', '2026-12-07')).toMatchObject({ kind: 'full', refundTotal: 429000 });
    expect(refundFor(booking('confirmed'), 'guest', '2026-12-09')).toMatchObject({ kind: 'partial', refundTotal: 210000 });
    expect(refundFor(booking('confirmed'), 'guest', '2026-12-12')).toMatchObject({ kind: 'none', refundTotal: 0 });
  });

  it('refunds in full and charges the host 10% of payout when the host cancels (design C6: ฿372)', () => {
    expect(refundFor(booking('confirmed'), 'host', '2026-12-11')).toMatchObject({
      kind: 'full',
      refundTotal: 429000,
      hostPenalty: 37200,
    });
  });

  it('refunds in full with no host fee when an admin cancels', () => {
    expect(refundFor(booking('confirmed'), 'admin', '2026-12-12')).toMatchObject({ kind: 'full', refundTotal: 429000, hostPenalty: 0 });
  });
});
