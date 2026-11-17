import { computeStayTotals } from './stay-totals';

describe('computeStayTotals', () => {
  const stay = { checkIn: '2026-12-12', checkOut: '2026-12-15', nights: 3 };
  const studio = { id: 'a', basePrice: 120000, cleaningFee: 30000, weeklyDiscountPct: 10 };
  const loft = { id: 'b', basePrice: 99000, cleaningFee: 20000, weeklyDiscountPct: 0 };

  it('is base price x nights without overrides (design: ฿1,200 x 3 = ฿3,600)', () => {
    expect(computeStayTotals([studio, loft], [], stay)).toEqual(
      new Map([
        ['a', 360000],
        ['b', 297000],
      ]),
    );
  });

  it('uses only that listing’s special prices', () => {
    const totals = computeStayTotals([studio, loft], [{ listingId: 'a', date: '2026-12-13', price: 150000 }], stay);
    expect(totals.get('a')).toBe(390000);
    expect(totals.get('b')).toBe(297000);
  });

  it('applies the weekly discount from 7 nights', () => {
    const week = { checkIn: '2026-12-12', checkOut: '2026-12-19', nights: 7 };
    expect(computeStayTotals([studio], [], week).get('a')).toBe(756000); // 840,000 - 10%
  });
});
