import type { LatLng, PlaceDto } from '@hongwang/shared';

/**
 * Built-in Bangkok neighbourhoods for the "Where" autocomplete and `?place=` search.
 * Centers are approximate (usually the BTS/MRT station); the bbox is a square of `radiusKm`
 * around the center. No geocoder: Bangkok is the whole market for the MVP.
 */
interface PlaceDef {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  /** Other spellings people type ("Thonglor", "Chinatown"). */
  aliases?: string[];
}

const PLACE_DEFS: PlaceDef[] = [
  { slug: 'ari', name: 'Ari', lat: 13.7797, lng: 100.5446, radiusKm: 2, aliases: ['aree', 'phahon yothin'] },
  { slug: 'saphan-khwai', name: 'Saphan Khwai', lat: 13.7937, lng: 100.5497, radiusKm: 1.5, aliases: ['saphan kwai', 'pradiphat'] },
  { slug: 'sanam-pao', name: 'Sanam Pao', lat: 13.7726, lng: 100.5422, radiusKm: 1.2 },
  { slug: 'pradiphat', name: 'Pradiphat', lat: 13.7889, lng: 100.5403, radiusKm: 1.2, aliases: ['pradipat'] },
  { slug: 'victory-monument', name: 'Victory Monument', lat: 13.7649, lng: 100.5383, radiusKm: 1.5, aliases: ['anusawari', 'phaya thai'] },
  { slug: 'siam', name: 'Siam', lat: 13.7456, lng: 100.5341, radiusKm: 1.5, aliases: ['pathum wan', 'chit lom', 'ratchaprasong'] },
  { slug: 'asok', name: 'Asok', lat: 13.737, lng: 100.5603, radiusKm: 1.5, aliases: ['asoke', 'sukhumvit', 'nana', 'sukhumvit 21'] },
  { slug: 'phrom-phong', name: 'Phrom Phong', lat: 13.7305, lng: 100.5697, radiusKm: 1.2, aliases: ['phromphong', 'prompong', 'sukhumvit 39'] },
  { slug: 'thong-lo', name: 'Thong Lo', lat: 13.7242, lng: 100.5785, radiusKm: 1.5, aliases: ['thonglor', 'thong lor', 'thonglo', 'sukhumvit 55'] },
  { slug: 'ekkamai', name: 'Ekkamai', lat: 13.7196, lng: 100.5851, radiusKm: 1.5, aliases: ['ekamai', 'sukhumvit 63'] },
  { slug: 'on-nut', name: 'On Nut', lat: 13.7056, lng: 100.601, radiusKm: 1.5, aliases: ['onnut', 'phra khanong'] },
  { slug: 'silom', name: 'Silom', lat: 13.7286, lng: 100.5343, radiusKm: 1.5, aliases: ['sala daeng', 'saladaeng', 'lumphini'] },
  { slug: 'sathorn', name: 'Sathorn', lat: 13.721, lng: 100.529, radiusKm: 1.5, aliases: ['sathon', 'chong nonsi'] },
  { slug: 'bang-rak', name: 'Bang Rak', lat: 13.7262, lng: 100.518, radiusKm: 1.2, aliases: ['bangrak', 'si phraya', 'sam yan'] },
  { slug: 'charoen-krung', name: 'Charoen Krung', lat: 13.731, lng: 100.514, radiusKm: 1.2, aliases: ['charoenkrung', 'new road'] },
  { slug: 'talat-noi', name: 'Talat Noi', lat: 13.7334, lng: 100.5137, radiusKm: 0.8, aliases: ['talad noi', 'talat noi'] },
  { slug: 'yaowarat', name: 'Yaowarat', lat: 13.74, lng: 100.509, radiusKm: 1.2, aliases: ['chinatown', 'samphanthawong', 'wat mangkon'] },
  { slug: 'old-town', name: 'Old Town', lat: 13.7525, lng: 100.4935, radiusKm: 2, aliases: ['rattanakosin', 'khao san', 'banglamphu', 'phra nakhon'] },
  { slug: 'ratchada', name: 'Ratchada', lat: 13.766, lng: 100.5715, radiusKm: 2, aliases: ['ratchadaphisek', 'huai khwang', 'thailand cultural centre'] },
  { slug: 'chatuchak', name: 'Chatuchak', lat: 13.7999, lng: 100.5534, radiusKm: 2, aliases: ['jatujak', 'mo chit', 'mochit'] },
  { slug: 'riverside', name: 'Riverside', lat: 13.7187, lng: 100.5143, radiusKm: 2, aliases: ['chao phraya', 'saphan taksin', 'khlong san', 'iconsiam'] },
  { slug: 'bangkok', name: 'Bangkok', lat: 13.7563, lng: 100.5018, radiusKm: 25, aliases: ['krung thep', 'bkk', 'all of bangkok'] },
];

const KM_PER_DEG_LAT = 111.32;

const round = (n: number, dp = 4) => Number(n.toFixed(dp));

/** 'west,south,east,north' around a point. */
export function bboxAround(center: LatLng, radiusKm: number): string {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = radiusKm / (KM_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180));
  return [center.lng - dLng, center.lat - dLat, center.lng + dLng, center.lat + dLat].map((n) => round(n)).join(',');
}

export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Parses 'west,south,east,north'; returns null when malformed or out of range. Corners are normalised. */
export function parseBbox(value: string | undefined | null): Bbox | null {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [a, b, c, d] = parts as [number, number, number, number];
  const west = Math.min(a, c);
  const east = Math.max(a, c);
  const south = Math.min(b, d);
  const north = Math.max(b, d);
  if (west < -180 || east > 180 || south < -90 || north > 90) return null;
  if (west === east || south === north) return null;
  return { west, south, east, north };
}

export const BANGKOK_PLACES: readonly PlaceDto[] = PLACE_DEFS.map((p) => ({
  slug: p.slug,
  name: p.name,
  label: p.slug === 'bangkok' ? 'Bangkok, Thailand' : `${p.name}, Bangkok`,
  center: { lat: p.lat, lng: p.lng },
  bbox: bboxAround({ lat: p.lat, lng: p.lng }, p.radiusKm),
}));

const BY_SLUG = new Map(BANGKOK_PLACES.map((p) => [p.slug, p]));
const ALIASES = new Map(PLACE_DEFS.map((p) => [p.slug, [p.name, ...(p.aliases ?? [])].map(normalize)]));

/** Lowercase, no accents, no punctuation or spaces: "Thong-Lo " -> "thonglo". */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9฀-๿]+/g, '');
}

export function findPlace(slug: string | undefined | null): PlaceDto | null {
  if (!slug) return null;
  return BY_SLUG.get(slug.toLowerCase()) ?? null;
}

/**
 * Autocomplete. Empty query returns every neighbourhood (city-wide 'bangkok' last).
 * Otherwise: names/aliases that start with the query first, then ones that contain it.
 */
export function searchPlaces(q: string, limit = 8): PlaceDto[] {
  const needle = normalize(q.split(',')[0] ?? '');
  if (!needle) return [...BANGKOK_PLACES];
  const scored: { place: PlaceDto; score: number; order: number }[] = [];
  BANGKOK_PLACES.forEach((place, order) => {
    const names = ALIASES.get(place.slug) ?? [];
    let score = 0;
    if (names[0] === needle) score = 4;
    else if (names[0]!.startsWith(needle)) score = 3;
    else if (names.some((n) => n.startsWith(needle))) score = 2;
    else if (names.some((n) => n.includes(needle))) score = 1;
    if (score) scored.push({ place, score, order });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.place);
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Closest neighbourhood (not the city-wide entry) within `maxKm`, used to fill `listings.area`. */
export function nearestPlace(point: LatLng, maxKm = 3): PlaceDto | null {
  let best: { place: PlaceDto; km: number } | null = null;
  for (const place of BANGKOK_PLACES) {
    if (place.slug === 'bangkok') continue;
    const km = distanceKm(point, place.center);
    if (km <= maxKm && (!best || km < best.km)) best = { place, km };
  }
  return best?.place ?? null;
}
