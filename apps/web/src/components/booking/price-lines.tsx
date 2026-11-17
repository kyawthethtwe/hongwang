import { roundToBaht, type PriceQuote } from '@hongwang/shared';
import { formatTHB, pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';

type Pricing = Pick<PriceQuote, 'nightly' | 'nightsSubtotal' | 'weeklyDiscount' | 'cleaningFee' | 'serviceFee' | 'total'>;

function Row({ label, value, strong, className }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cn('flex justify-between gap-3', strong && 'font-semibold', className)}>
      <dt className={strong ? undefined : 'text-ink-2'}>{label}</dt>
      <dd className="m-0 text-right font-tabular">{value}</dd>
    </div>
  );
}

/** "฿1,200 × 3 nights" when every night costs the same, else "3 nights (avg ฿1,300)". */
export function nightsLabel(nightly: Pricing['nightly'], subtotal: number) {
  const n = nightly.length;
  if (n === 0) return 'Nights';
  const first = nightly[0]!.price;
  return nightly.every((x) => x.price === first)
    ? `${formatTHB(first)} × ${pluralize(n, 'night')}`
    : `${pluralize(n, 'night')} (avg ${formatTHB(roundToBaht(subtotal / n))})`;
}

/**
 * Price breakdown used by the reserve card, checkout summary and trip receipt:
 * nights, weekly discount, cleaning fee, service fee, total.
 */
export function PriceLines({
  pricing,
  totalLabel = 'Total',
  extra,
  className,
}: {
  pricing: Pricing;
  totalLabel?: React.ReactNode;
  /** Rows after the total (e.g. "Refunded"). */
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <dl className={cn('m-0 flex flex-col gap-2.5', className)}>
      <Row label={nightsLabel(pricing.nightly, pricing.nightsSubtotal)} value={formatTHB(pricing.nightsSubtotal)} />
      {pricing.weeklyDiscount > 0 && <Row label="Weekly discount" value={formatTHB(-pricing.weeklyDiscount)} />}
      {pricing.cleaningFee > 0 && <Row label="Cleaning fee" value={formatTHB(pricing.cleaningFee)} />}
      <Row label="Service fee" value={formatTHB(pricing.serviceFee)} />
      <Row label={totalLabel} value={formatTHB(pricing.total)} strong className="border-t border-line pt-3" />
      {extra}
    </dl>
  );
}

export { Row as PriceRow };
