import { eachNight, type IsoDate } from './dates';
import { roundToBaht, type Satang } from './money';

/** Guests pay a service fee of 10% of nights + cleaning (design: ฿3,900 -> ฿390). */
export const GUEST_SERVICE_FEE_RATE = 0.1;
/** Hongwang keeps 5% of the nightly total from the host (design: ฿3,600 -> ฿180). */
export const HOST_FEE_RATE = 0.05;
/** When a host cancels a confirmed stay they pay 10% of the payout (design: ฿3,720 -> ฿372). */
export const HOST_CANCELLATION_FEE_RATE = 0.1;

export interface PricingInput {
  checkIn: IsoDate;
  checkOut: IsoDate;
  basePrice: Satang;
  cleaningFee: Satang;
  /** 0-100, applied to the nightly subtotal when the stay is 7 nights or more. */
  weeklyDiscountPct?: number;
  /** Per-date special prices from the host calendar, keyed 'YYYY-MM-DD'. */
  priceOverrides?: Record<IsoDate, Satang>;
}

export interface NightPrice {
  date: IsoDate;
  price: Satang;
}

export interface PriceQuote {
  nights: number;
  nightly: NightPrice[];
  /** Sum of nightly prices before discount. */
  nightsSubtotal: Satang;
  weeklyDiscount: Satang;
  /** nightsSubtotal - weeklyDiscount */
  nightsTotal: Satang;
  cleaningFee: Satang;
  serviceFee: Satang;
  /** What the guest pays. */
  total: Satang;
  hostFee: Satang;
  /** What the host receives: nightsTotal + cleaningFee - hostFee. */
  hostPayout: Satang;
  currency: 'THB';
}

export function quoteStay(input: PricingInput): PriceQuote {
  const nightly = eachNight(input.checkIn, input.checkOut).map((date) => ({
    date,
    price: input.priceOverrides?.[date] ?? input.basePrice,
  }));
  const nights = nightly.length;
  const nightsSubtotal = nightly.reduce((s, n) => s + n.price, 0);
  const pct = nights >= 7 ? Math.min(Math.max(input.weeklyDiscountPct ?? 0, 0), 100) : 0;
  const weeklyDiscount = roundToBaht((nightsSubtotal * pct) / 100);
  const nightsTotal = nightsSubtotal - weeklyDiscount;
  const cleaningFee = input.cleaningFee;
  const serviceFee = roundToBaht((nightsTotal + cleaningFee) * GUEST_SERVICE_FEE_RATE);
  const hostFee = roundToBaht(nightsTotal * HOST_FEE_RATE);
  return {
    nights,
    nightly,
    nightsSubtotal,
    weeklyDiscount,
    nightsTotal,
    cleaningFee,
    serviceFee,
    total: nightsTotal + cleaningFee + serviceFee,
    hostFee,
    hostPayout: nightsTotal + cleaningFee - hostFee,
    currency: 'THB',
  };
}
