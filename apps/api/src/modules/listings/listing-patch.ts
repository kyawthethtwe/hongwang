import type { UpdateListingInput } from '@hongwang/shared';
import { badRequest } from '../../common/errors';
import type { listings } from '../../database/schema';
import { nearestPlace } from '../search/places';
import type { ListingRow } from './listing.mappers';
import { publicLocationFor, toXY } from './public-location';

export type ListingPatch = Partial<typeof listings.$inferInsert>;

/**
 * Turns a partial editor save into column updates. Pure (no DB), so it is unit tested.
 * - `exactLocation` sets `location` and recomputes the public pin (150-350 m away, stable per id).
 *   Unless the save also sends `area`, `area` follows the pin to the nearest known neighbourhood
 *   (falling back to the subdistrict).
 * - min/max nights are checked against each other after merging with the stored values.
 */
export function buildListingPatch(row: ListingRow, input: UpdateListingInput): ListingPatch {
  const { exactLocation, ...rest } = input;
  const patch: ListingPatch = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) (patch as Record<string, unknown>)[k] = v;
  }

  if (exactLocation) {
    const location = toXY(exactLocation);
    patch.location = location;
    patch.publicLocation = publicLocationFor(row.id, location);
    if (input.area === undefined) {
      const place = nearestPlace(exactLocation);
      const area = place?.name ?? input.subdistrict ?? row.subdistrict ?? row.area;
      if (area) patch.area = area;
    }
  }

  const minNights = patch.minNights ?? row.minNights;
  const maxNights = patch.maxNights ?? row.maxNights;
  if (maxNights < minNights) {
    throw badRequest('Maximum nights must be at least the minimum', [
      { path: ['maxNights'], message: 'Must be at least the minimum nights' },
    ]);
  }
  return patch;
}
