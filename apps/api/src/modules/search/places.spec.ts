import { BANGKOK_PLACES, bboxAround, distanceKm, findPlace, nearestPlace, normalize, parseBbox, searchPlaces } from './places';

describe('places', () => {
  it('has the required Bangkok neighbourhoods with unique slugs', () => {
    const slugs = BANGKOK_PLACES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of ['ari', 'saphan-khwai', 'sanam-pao', 'victory-monument', 'siam', 'asok', 'phrom-phong', 'thong-lo', 'ekkamai', 'on-nut', 'silom', 'sathorn', 'bang-rak', 'charoen-krung', 'talat-noi', 'yaowarat', 'old-town', 'ratchada', 'chatuchak', 'riverside']) {
      expect(slugs).toContain(s);
    }
  });

  it('gives every place a label and a bbox that contains its center', () => {
    for (const p of BANGKOK_PLACES) {
      expect(p.label).toContain(p.name);
      const b = parseBbox(p.bbox)!;
      expect(b).not.toBeNull();
      expect(p.center.lng).toBeGreaterThan(b.west);
      expect(p.center.lng).toBeLessThan(b.east);
      expect(p.center.lat).toBeGreaterThan(b.south);
      expect(p.center.lat).toBeLessThan(b.north);
    }
  });

  it('finds by slug, case-insensitively', () => {
    expect(findPlace('ari')?.name).toBe('Ari');
    expect(findPlace('THONG-LO')?.name).toBe('Thong Lo');
    expect(findPlace('atlantis')).toBeNull();
    expect(findPlace(undefined)).toBeNull();
  });

  it('autocompletes names and aliases, prefix matches first', () => {
    expect(searchPlaces('ari')[0]?.slug).toBe('ari');
    expect(searchPlaces('thonglor')[0]?.slug).toBe('thong-lo');
    expect(searchPlaces('Thong Lo')[0]?.slug).toBe('thong-lo');
    expect(searchPlaces('chinatown')[0]?.slug).toBe('yaowarat');
    expect(searchPlaces('Ari, Bangkok')[0]?.slug).toBe('ari');
    expect(searchPlaces('s').every((p) => p.name.length > 0)).toBe(true);
    expect(searchPlaces('s', 3)).toHaveLength(3);
    expect(searchPlaces('zzzz')).toEqual([]);
  });

  it('returns everything for an empty query', () => {
    expect(searchPlaces('')).toHaveLength(BANGKOK_PLACES.length);
  });

  it('normalizes punctuation, case and accents', () => {
    expect(normalize(' Thong-Lo ')).toBe('thonglo');
    expect(normalize('Café')).toBe('cafe');
  });

  it('parses and normalises bboxes, rejecting bad ones', () => {
    expect(parseBbox('100.5,13.7,100.6,13.8')).toEqual({ west: 100.5, south: 13.7, east: 100.6, north: 13.8 });
    expect(parseBbox('100.6,13.8,100.5,13.7')).toEqual({ west: 100.5, south: 13.7, east: 100.6, north: 13.8 });
    expect(parseBbox('1,2,3')).toBeNull();
    expect(parseBbox('200,0,201,1')).toBeNull();
    expect(parseBbox('1,1,1,2')).toBeNull();
    expect(parseBbox(undefined)).toBeNull();
  });

  it('builds a bbox of roughly the requested radius', () => {
    const b = parseBbox(bboxAround({ lat: 13.75, lng: 100.5 }, 1))!;
    expect(distanceKm({ lat: b.south, lng: 100.5 }, { lat: b.north, lng: 100.5 })).toBeCloseTo(2, 1);
    expect(distanceKm({ lat: 13.75, lng: b.west }, { lat: 13.75, lng: b.east })).toBeCloseTo(2, 1);
  });

  it('finds the nearest neighbourhood for a pin', () => {
    expect(nearestPlace({ lat: 13.7801, lng: 100.5452 })?.slug).toBe('ari');
    expect(nearestPlace({ lat: 13.7334, lng: 100.5137 })?.slug).toBe('talat-noi');
    expect(nearestPlace({ lat: 18.79, lng: 98.98 })).toBeNull(); // Chiang Mai
  });
});
