import { customType, timestamp } from 'drizzle-orm/pg-core';

/** Case-insensitive text (emails). Needs the citext extension. */
export const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

/** Postgres daterange, as its literal '[2026-12-12,2026-12-15)'. */
export const daterange = customType<{ data: string }>({
  dataType: () => 'daterange',
});

export interface XY {
  /** longitude */
  x: number;
  /** latitude */
  y: number;
}

/** Reads PostGIS hex (E)WKB for a 2D point. */
function parsePointWkb(hex: string): XY {
  const buf = Buffer.from(hex, 'hex');
  const le = buf.readUInt8(0) === 1;
  const type = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  let offset = 5;
  if (type & 0x20000000) offset += 4; // SRID present
  const x = le ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
  const y = le ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);
  return { x, y };
}

type GeoJsonPoint = { type: 'Point'; coordinates: [number, number] };

/**
 * Reads a point in either form Postgres hands back:
 * - hex (E)WKB string, from plain selects;
 * - GeoJSON object (or its JSON text), from Drizzle relational queries (`db.query.x.findMany({ with })`),
 *   which build nested rows with json_build_array, where PostGIS casts geometry to GeoJSON.
 */
export function parsePoint(v: unknown): XY {
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.startsWith('{')) return parsePoint(JSON.parse(s));
    return parsePointWkb(s);
  }
  if (v && typeof v === 'object' && Array.isArray((v as GeoJsonPoint).coordinates)) {
    const [x, y] = (v as GeoJsonPoint).coordinates;
    return { x, y };
  }
  throw new Error(`Unsupported point value from the database: ${JSON.stringify(v)}`);
}

/**
 * WGS84 point stored as geometry(Point, 4326); x = lng, y = lat. Written as EWKT so the SRID
 * matches the column (Drizzle's built-in geometry type omits it).
 * In raw SQL, cast to geography for metres: ST_DWithin(public_location::geography, ..., 800).
 */
export const point = customType<{ data: XY; driverData: string | GeoJsonPoint }>({
  dataType: () => 'geometry(Point, 4326)',
  toDriver: (v) => `SRID=4326;POINT(${v.x} ${v.y})`,
  fromDriver: (v) => parsePoint(v),
});

export const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
export const tstz = (name: string) => timestamp(name, { withTimezone: true });
