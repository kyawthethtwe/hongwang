import { createHash } from 'node:crypto';
import type { LatLng } from '@hongwang/shared';
import type { XY } from '../../database/schema/types';
import { distanceKm } from '../search/places';

/**
 * The public pin guests see (search, map, listing page) is the front door moved 150-350 m in a
 * direction derived from the listing id. Deterministic, so moving the pin by a metre doesn't make
 * the public pin jump around (averaging many saves can't reveal the door), and the same listing
 * always gets the same offset.
 */
export const PUBLIC_OFFSET_MIN_M = 150;
export const PUBLIC_OFFSET_MAX_M = 350;
const M_PER_DEG_LAT = 111_320;

/** Offset (metres, bearing in radians) for a listing id. */
export function publicOffsetFor(listingId: string): { meters: number; bearing: number } {
  const h = createHash('sha256').update(`hongwang:public-location:${listingId}`).digest();
  const u1 = h.readUInt32BE(0) / 0xffffffff;
  const u2 = h.readUInt32BE(4) / 0xffffffff;
  return {
    meters: PUBLIC_OFFSET_MIN_M + (PUBLIC_OFFSET_MAX_M - PUBLIC_OFFSET_MIN_M) * u1,
    bearing: 2 * Math.PI * u2,
  };
}

/** exact {x: lng, y: lat} -> public {x, y}, rounded to 6 dp (~0.1 m). */
export function publicLocationFor(listingId: string, exact: XY): XY {
  const { meters, bearing } = publicOffsetFor(listingId);
  const cosLat = Math.max(0.01, Math.cos((exact.y * Math.PI) / 180));
  const dLat = (meters * Math.cos(bearing)) / M_PER_DEG_LAT;
  const dLng = (meters * Math.sin(bearing)) / (M_PER_DEG_LAT * cosLat);
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  return { x: round(exact.x + dLng), y: round(exact.y + dLat) };
}

export const toXY = (p: LatLng): XY => ({ x: p.lng, y: p.lat });

/** Distance between two {x,y} points in metres. */
export const distanceMeters = (a: XY, b: XY) => distanceKm({ lat: a.y, lng: a.x }, { lat: b.y, lng: b.x }) * 1000;
