import { describe, expect, it } from 'vitest';
import { guestRefund, hostCancellationRefund } from './cancellation';
import { nextStatus } from './booking-state';
import { quoteStay } from './pricing';

// Numbers from the design: Sunny studio, ฿1,200 x 3 nights, ฿300 cleaning.
const studio = { checkIn: '2026-12-12', checkOut: '2026-12-15', basePrice: 120000, cleaningFee: 30000 };

describe('quoteStay', () => {
  it('matches the checkout design totals', () => {
    const q = quoteStay(studio);
    expect(q.nights).toBe(3);
    expect(q.nightsTotal).toBe(360000);
    expect(q.serviceFee).toBe(39000);
    expect(q.total).toBe(429000);
    expect(q.hostFee).toBe(18000);
    expect(q.hostPayout).toBe(372000);
  });

  it('uses special prices and the weekly discount', () => {
    const q = quoteStay({
      checkIn: '2026-12-20',
      checkOut: '2026-12-27',
      basePrice: 120000,
      cleaningFee: 0,
      weeklyDiscountPct: 10,
      priceOverrides: { '2026-12-24': 200000 },
    });
    expect(q.nightsSubtotal).toBe(6 * 120000 + 200000);
    expect(q.weeklyDiscount).toBe(92000);
  });
});

describe('cancellation', () => {
  const paid = quoteStay(studio);
  it('moderate: half the nights back inside 5 days (design B2: ฿2,100)', () => {
    const r = guestRefund('moderate', '2026-12-12', '2026-12-10', paid);
    expect(r.kind).toBe('partial');
    expect(r.refundTotal).toBe(210000);
    expect(r.freeCancellationUntil).toBe('2026-12-07');
  });
  it('moderate: full refund before the window', () => {
    expect(guestRefund('moderate', '2026-12-12', '2026-12-07', paid).refundTotal).toBe(429000);
  });
  it('host cancel: full refund, 10% payout penalty (design C6: ฿372)', () => {
    const r = hostCancellationRefund('moderate', '2026-12-12', paid);
    expect(r.refundTotal).toBe(429000);
    expect(r.hostPenalty).toBe(37200);
  });
});

describe('state machine', () => {
  it('only hosts approve, only the system confirms payment', () => {
    expect(nextStatus('requested', 'approve', 'host')).toBe('payment_hold');
    expect(nextStatus('requested', 'approve', 'guest')).toBeNull();
    expect(nextStatus('payment_hold', 'pay', 'system')).toBe('confirmed');
    expect(nextStatus('confirmed', 'cancel', 'host')).toBe('cancelled');
    expect(nextStatus('completed', 'cancel', 'admin')).toBeNull();
  });
});
