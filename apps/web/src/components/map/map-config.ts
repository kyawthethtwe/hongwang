/** MapLibre style (vector tiles). Free OpenFreeMap style by default; set NEXT_PUBLIC_MAP_STYLE_URL to swap. */
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';

export const BANGKOK_VIEW = { longitude: 100.5018, latitude: 13.7563, zoom: 11.5 } as const;

/** Reads a design token (e.g. '--color-brand') for MapLibre paint, which can't use CSS variables. */
export function tokenColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** 'west,south,east,north' -> [[w,s],[e,n]] */
export function bboxToBounds(bbox: string): [[number, number], [number, number]] | null {
  const p = bbox.split(',').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = p as [number, number, number, number];
  return [
    [w, s],
    [e, n],
  ];
}

export const boundsToBbox = (b: { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number }) =>
  [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(4)).join(',');
