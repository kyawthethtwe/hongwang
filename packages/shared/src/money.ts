/**
 * All money is stored and sent as integer satang (1 THB = 100 satang), the unit Stripe uses for THB.
 * Never use floats for money. Format only at the edge with formatTHB.
 */
export type Satang = number;

export const toSatang = (baht: number): Satang => Math.round(baht * 100);
export const toBaht = (satang: Satang): number => satang / 100;

/** 120000 -> "฿1,200". Shows decimals only when the amount has them. */
export function formatTHB(satang: Satang, opts: { sign?: boolean } = {}): string {
  const baht = satang / 100;
  const hasFraction = satang % 100 !== 0;
  const abs = Math.abs(baht).toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
  const neg = baht < 0 ? '−' : opts.sign && baht > 0 ? '+' : '';
  return `${neg}฿${abs}`;
}

/** Round a satang amount to whole baht (used for fees so totals stay in whole baht). */
export const roundToBaht = (satang: Satang): Satang => Math.round(satang / 100) * 100;
