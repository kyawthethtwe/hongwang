import { quoteStay, type IsoDate, type Satang } from '@hongwang/shared';
import { and, gte, inArray, lt } from 'drizzle-orm';
import type { DbOrTx } from '../../database/database.module';
import { listingPriceOverrides } from '../../database/schema';
import type { Stay } from './search-sql';

export interface PricedListing {
  id: string;
  basePrice: Satang;
  cleaningFee: Satang;
  weeklyDiscountPct: number;
}

export interface OverrideRow {
  listingId: string;
  date: IsoDate;
  price: Satang;
}

/** Nights total (special prices + weekly discount) per listing, via quoteStay. Pure. */
export function computeStayTotals(listings: PricedListing[], overrides: OverrideRow[], stay: Stay): Map<string, Satang> {
  const byListing = new Map<string, Record<IsoDate, Satang>>();
  for (const o of overrides) {
    const m = byListing.get(o.listingId) ?? {};
    m[o.date] = o.price;
    byListing.set(o.listingId, m);
  }
  const out = new Map<string, Satang>();
  for (const l of listings) {
    const q = quoteStay({
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      basePrice: Number(l.basePrice),
      cleaningFee: Number(l.cleaningFee),
      weeklyDiscountPct: Number(l.weeklyDiscountPct),
      priceOverrides: byListing.get(l.id),
    });
    out.set(l.id, q.nightsTotal);
  }
  return out;
}

/** Loads the special prices of `listings` for the stay and returns their nights totals. */
export async function loadStayTotals(db: DbOrTx, listings: PricedListing[], stay: Stay | null): Promise<Map<string, Satang>> {
  if (!stay || listings.length === 0) return new Map();
  const overrides = await db
    .select({ listingId: listingPriceOverrides.listingId, date: listingPriceOverrides.date, price: listingPriceOverrides.price })
    .from(listingPriceOverrides)
    .where(
      and(
        inArray(
          listingPriceOverrides.listingId,
          listings.map((l) => l.id),
        ),
        gte(listingPriceOverrides.date, stay.checkIn),
        lt(listingPriceOverrides.date, stay.checkOut),
      ),
    );
  return computeStayTotals(listings, overrides, stay);
}
