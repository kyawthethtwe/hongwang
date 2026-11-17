import { daysBetween, type IsoDate } from './dates';
import type { CancellationPolicy } from './enums';
import { roundToBaht, type Satang } from './money';
import { HOST_CANCELLATION_FEE_RATE, type PriceQuote } from './pricing';

/**
 * Guest cancellation rules, by days before check-in (Bangkok calendar days):
 * - flexible: full refund until 1 day before check-in, then nothing.
 * - moderate: full refund until 5 days before, then 50% of nights until check-in.
 * - strict:   full refund until 14 days before, 50% of nights until 7 days before, then nothing.
 * "Full refund" returns everything. Otherwise cleaning is refunded, the service fee is not.
 * After check-in nothing is refunded by policy (support can still force a refund).
 */
export const CANCELLATION_POLICY_INFO: Record<
  CancellationPolicy,
  { label: string; summary: string; fullRefundDays: number; halfRefundDays: number }
> = {
  flexible: {
    label: 'Flexible',
    summary: 'Full refund until 1 day before check-in.',
    fullRefundDays: 1,
    halfRefundDays: 0,
  },
  moderate: {
    label: 'Moderate',
    summary: 'Full refund until 5 days before check-in, then 50% until check-in.',
    fullRefundDays: 5,
    halfRefundDays: 0,
  },
  strict: {
    label: 'Strict',
    summary: 'Full refund until 14 days before check-in, 50% until 7 days before, then none.',
    fullRefundDays: 14,
    halfRefundDays: 7,
  },
};

export interface RefundLine {
  label: string;
  paid: Satang;
  refund: Satang;
}

export interface RefundQuote {
  kind: 'full' | 'partial' | 'none';
  refundTotal: Satang;
  lines: RefundLine[];
  /** Last date (inclusive) on which a full refund applies. */
  freeCancellationUntil: IsoDate;
  /** Fee charged to the host (only for host cancellations). */
  hostPenalty: Satang;
}

type PaidAmounts = Pick<PriceQuote, 'nightsTotal' | 'cleaningFee' | 'serviceFee' | 'total' | 'hostPayout'>;

export function freeCancellationUntil(policy: CancellationPolicy, checkIn: IsoDate): IsoDate {
  const { fullRefundDays } = CANCELLATION_POLICY_INFO[policy];
  const d = new Date(`${checkIn}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - fullRefundDays);
  return d.toISOString().slice(0, 10);
}

export function guestRefund(
  policy: CancellationPolicy,
  checkIn: IsoDate,
  today: IsoDate,
  paid: PaidAmounts,
): RefundQuote {
  const info = CANCELLATION_POLICY_INFO[policy];
  const daysLeft = daysBetween(today, checkIn);
  const until = freeCancellationUntil(policy, checkIn);
  const lines = (nights: Satang, cleaning: Satang, service: Satang): RefundLine[] => [
    { label: 'Nights', paid: paid.nightsTotal, refund: nights },
    { label: 'Cleaning fee', paid: paid.cleaningFee, refund: cleaning },
    { label: 'Service fee', paid: paid.serviceFee, refund: service },
  ];
  if (daysLeft >= info.fullRefundDays) {
    return {
      kind: 'full',
      refundTotal: paid.total,
      lines: lines(paid.nightsTotal, paid.cleaningFee, paid.serviceFee),
      freeCancellationUntil: until,
      hostPenalty: 0,
    };
  }
  if (daysLeft > 0 && daysLeft >= info.halfRefundDays) {
    const nights = roundToBaht(paid.nightsTotal / 2);
    return {
      kind: 'partial',
      refundTotal: nights + paid.cleaningFee,
      lines: lines(nights, paid.cleaningFee, 0),
      freeCancellationUntil: until,
      hostPenalty: 0,
    };
  }
  return { kind: 'none', refundTotal: 0, lines: lines(0, 0, 0), freeCancellationUntil: until, hostPenalty: 0 };
}

/** Host cancels a confirmed stay: guest always gets everything back, host pays 10% of payout. */
export function hostCancellationRefund(policy: CancellationPolicy, checkIn: IsoDate, paid: PaidAmounts): RefundQuote {
  return {
    kind: 'full',
    refundTotal: paid.total,
    lines: [
      { label: 'Nights', paid: paid.nightsTotal, refund: paid.nightsTotal },
      { label: 'Cleaning fee', paid: paid.cleaningFee, refund: paid.cleaningFee },
      { label: 'Service fee', paid: paid.serviceFee, refund: paid.serviceFee },
    ],
    freeCancellationUntil: freeCancellationUntil(policy, checkIn),
    hostPenalty: roundToBaht(paid.hostPayout * HOST_CANCELLATION_FEE_RATE),
  };
}
