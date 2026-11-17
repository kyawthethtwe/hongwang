/**
 * Opaque pagination cursor for search results. It is a base64url-encoded offset: search results
 * are ranked by computed scores, so keyset pagination would need the score in the cursor too, and
 * result sets are small (one city).
 */
const MAX_OFFSET = 10_000;

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: Math.max(0, Math.floor(offset)) }), 'utf8').toString('base64url');
}

/** Returns the offset, 0 when no cursor was sent, or null when the cursor is not one of ours. */
export function decodeCursor(cursor: string | undefined | null): number | null {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const o = (parsed as { o?: unknown }).o;
    if (typeof o !== 'number' || !Number.isInteger(o) || o < 0 || o > MAX_OFFSET) return null;
    return o;
  } catch {
    return null;
  }
}
