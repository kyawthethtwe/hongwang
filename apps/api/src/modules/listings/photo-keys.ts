/** Pure helpers for listing photo storage keys and reordering (unit tested). */

/** Storage prefix for a listing's photos: `listings/<id>/`. */
export const photoPrefix = (listingId: string) => `listings/${listingId}/`;

/** True when `key` is a direct child of the listing's prefix (no `..`, no sub-folders). */
export function isListingPhotoKey(listingId: string, key: string): boolean {
  const prefix = photoPrefix(listingId);
  if (!key.startsWith(prefix)) return false;
  const name = key.slice(prefix.length);
  return /^[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/.test(name);
}

/** Same set of ids, each once. */
export function isSamePhotoSet(current: string[], requested: string[]): boolean {
  if (current.length !== requested.length) return false;
  const want = new Set(requested);
  if (want.size !== requested.length) return false;
  return current.every((id) => want.has(id));
}
