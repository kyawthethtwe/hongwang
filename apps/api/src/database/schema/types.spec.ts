import { parsePoint } from './types';

describe('parsePoint', () => {
  // SELECT ST_GeomFromEWKT('SRID=4326;POINT(100.5452 13.7801)')::text
  const ewkbHex = '0101000020E6100000DE718A8EE42259401D386744698F2B40';

  it('reads hex EWKB from plain selects', () => {
    expect(parsePoint(ewkbHex)).toEqual({ x: 100.5452, y: 13.7801 });
  });

  it('reads GeoJSON objects from relational (json_build_array) queries', () => {
    expect(parsePoint({ type: 'Point', coordinates: [100.5452, 13.7801] })).toEqual({ x: 100.5452, y: 13.7801 });
  });

  it('reads GeoJSON text', () => {
    expect(parsePoint('{"type":"Point","coordinates":[100.5,13.7]}')).toEqual({ x: 100.5, y: 13.7 });
  });

  it('rejects anything else', () => {
    expect(() => parsePoint(42)).toThrow(/Unsupported point/);
  });
});
