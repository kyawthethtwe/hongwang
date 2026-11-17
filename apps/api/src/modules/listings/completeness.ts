import {
  CANCELLATION_POLICIES,
  LISTING_EDITOR_SECTIONS,
  MIN_LISTING_PHOTOS,
  type ListingEditorSection,
} from '@hongwang/shared';
import type { listings } from '../../database/schema';

type ListingRow = typeof listings.$inferSelect;

export type CompletenessInput = Pick<
  ListingRow,
  | 'title'
  | 'description'
  | 'maxGuests'
  | 'beds'
  | 'addressLine'
  | 'subdistrict'
  | 'district'
  | 'province'
  | 'postcode'
  | 'location'
  | 'amenities'
  | 'basePrice'
  | 'minNights'
  | 'maxNights'
  | 'checkInFrom'
  | 'checkOutBy'
  | 'cancellationPolicy'
  | 'houseRules'
>;

/** Lowest nightly price the editor accepts (฿100), same as updateListingInputSchema. */
export const MIN_BASE_PRICE = 10_000;

const filled = (s: string | null | undefined) => !!s && s.trim().length > 0;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Which editor sections (design C4) have what a guest needs. Purely data-driven: sections whose
 * fields all have valid defaults (availability, policies) start complete.
 */
export function listingCompleteness(l: CompletenessInput, photoCount: number): Record<ListingEditorSection, boolean> {
  return {
    basics: filled(l.title) && filled(l.description) && l.maxGuests >= 1 && l.beds >= 1,
    location:
      filled(l.addressLine) &&
      filled(l.subdistrict) &&
      filled(l.district) &&
      filled(l.province) &&
      /^\d{5}$/.test(l.postcode ?? '') &&
      l.location !== null &&
      l.location !== undefined,
    photos: photoCount >= MIN_LISTING_PHOTOS,
    amenities: (l.amenities ?? []).length > 0,
    pricing: l.basePrice >= MIN_BASE_PRICE,
    availability: l.minNights >= 1 && l.maxNights >= l.minNights && HHMM.test(l.checkInFrom) && HHMM.test(l.checkOutBy),
    policies: (CANCELLATION_POLICIES as readonly string[]).includes(l.cancellationPolicy) && !!l.houseRules,
  };
}

export function missingSections(c: Record<ListingEditorSection, boolean>): ListingEditorSection[] {
  return LISTING_EDITOR_SECTIONS.filter((s) => !c[s]);
}

/** Every section complete (photos implies at least MIN_LISTING_PHOTOS). */
export const isComplete = (c: Record<ListingEditorSection, boolean>) => missingSections(c).length === 0;
