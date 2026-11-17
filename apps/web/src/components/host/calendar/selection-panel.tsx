'use client';

import { ERROR_CODES, toBaht, toSatang, type HostCalendarDay, type HostCalendarDto } from '@hongwang/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '@/lib/api/client';
import { formatShortDay, formatTHB, pluralize } from '@/lib/format';
import { useSetBlocks, useSetPrices } from '@/lib/queries/host';
import { Button } from '@/components/ui/button';
import { Field, Input, Radio } from '@/components/ui/field';

const MIN_PRICE_BAHT = 100;

function listDays(days: HostCalendarDay[]) {
  const names = days.map((d) => formatShortDay(d.date));
  return names.length > 8 ? `${names.slice(0, 8).join(', ')} and ${names.length - 8} more` : names.join(', ');
}

/**
 * Side panel for selected nights (design C5): open or blocked, price per night, Save.
 * Calls PUT /host/calendar/:listingId/blocks and /prices; both return the refreshed month.
 */
export function SelectionPanel({
  calendar,
  days,
  onDone,
}: {
  calendar: HostCalendarDto;
  /** Selected nights, sorted. */
  days: HostCalendarDay[];
  onDone: () => void;
}) {
  const listingId = calendar.listing.id;
  const allBlocked = days.every((d) => d.state === 'blocked');
  const prices = new Set(days.map((d) => d.price));
  const commonPrice = prices.size === 1 ? String(toBaht(days[0]!.price)) : '';

  const [mode, setMode] = useState<'open' | 'blocked'>(allBlocked ? 'blocked' : 'open');
  const [price, setPrice] = useState<string | null>(null); // null: untouched
  const [error, setError] = useState<string | null>(null);
  const blocks = useSetBlocks(listingId);
  const setPrices = useSetPrices(listingId);
  const busy = blocks.isPending || setPrices.isPending;

  async function save() {
    setError(null);
    const priceValue = price === null ? null : price.trim();
    let priceSatang: number | undefined;
    if (priceValue !== null && priceValue !== '' && priceValue !== commonPrice) {
      const baht = Number(priceValue.replace(/,/g, ''));
      if (!Number.isFinite(baht) || baht < MIN_PRICE_BAHT) {
        setError(`Enter at least ฿${MIN_PRICE_BAHT}`);
        return;
      }
      priceSatang = toSatang(Math.round(baht));
    }
    const toBlock = mode === 'blocked' ? days.filter((d) => d.state === 'open').map((d) => d.date) : [];
    const toUnblock = mode === 'open' ? days.filter((d) => d.state === 'blocked').map((d) => d.date) : [];
    if (!toBlock.length && !toUnblock.length && priceSatang === undefined) {
      onDone();
      return;
    }
    try {
      if (toBlock.length) await blocks.mutateAsync({ dates: toBlock, blocked: true });
      if (toUnblock.length) await blocks.mutateAsync({ dates: toUnblock, blocked: false });
      if (priceSatang !== undefined) await setPrices.mutateAsync({ dates: days.map((d) => d.date), price: priceSatang });
      const what = [
        toBlock.length && `blocked ${pluralize(toBlock.length, 'night')}`,
        toUnblock.length && `opened ${pluralize(toUnblock.length, 'night')}`,
        priceSatang !== undefined && `set ${formatTHB(priceSatang)} a night`,
      ].filter(Boolean);
      toast.success(`Saved: ${what.join(', ')}.`);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === ERROR_CODES.datesUnavailable) {
        toast.error('Some of those nights were just booked, so they can’t be blocked. The calendar has been refreshed.');
      } else {
        toast.error(errorMessage(err));
      }
    }
  }

  return (
    <>
      <div>
        <h2 className="m-0 text-lg font-semibold">{days.length === 1 ? '1 night selected' : `${days.length} nights selected`}</h2>
        <p className="m-0 mt-1 text-ink-2">{listDays(days)}</p>
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 p-0 text-sm font-semibold">These nights are</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
          <Radio name="avail" checked={mode === 'open'} onChange={() => setMode('open')} />
          Open for booking
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
          <Radio name="avail" checked={mode === 'blocked'} onChange={() => setMode('blocked')} />
          Blocked
        </label>
      </fieldset>
      <Field
        label="Price per night (฿)"
        error={error ?? undefined}
        hint={prices.size > 1 ? 'The selected nights have different prices. Enter one to set them all.' : undefined}
      >
        {(p) => (
          <Input
            {...p}
            type="number"
            inputMode="numeric"
            min={MIN_PRICE_BAHT}
            step={1}
            placeholder={String(toBaht(calendar.listing.basePrice))}
            value={price ?? commonPrice}
            onChange={(e) => setPrice(e.target.value)}
          />
        )}
      </Field>
      {days.some((d) => d.isSpecialPrice) && (
        <Button
          variant="link"
          className="-mt-2 min-h-0 self-start text-sm"
          onClick={() => setPrice(String(toBaht(calendar.listing.basePrice)))}
        >
          Use the base price ({formatTHB(calendar.listing.basePrice)})
        </Button>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="lg" className="flex-1" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button size="lg" className="flex-1" loading={busy} onClick={save}>
          Save
        </Button>
      </div>
      <p className="m-0 text-[13px] text-muted">Changes apply to new bookings only. Guests who already booked keep their price.</p>
    </>
  );
}
