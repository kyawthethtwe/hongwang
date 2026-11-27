import { buildListingPatch } from './listing-patch';
import { listingRow } from './listing.fixture';
import { distanceMeters, publicLocationFor } from './public-location';

describe('buildListingPatch', () => {
  const row = listingRow();

  it('copies only the fields that were sent', () => {
    expect(buildListingPatch(row, { title: 'New title', basePrice: 130000 })).toEqual({ title: 'New title', basePrice: 130000 });
    expect(buildListingPatch(row, {})).toEqual({});
  });

  it('keeps explicit nulls', () => {
    expect(buildListingPatch(row, { floor: null, sizeSqm: null })).toEqual({ floor: null, sizeSqm: null });
  });

  it('sets the exact pin and a public pin 150-350 m away', () => {
    const patch = buildListingPatch(row, { exactLocation: { lat: 13.7334, lng: 100.5137 } });
    expect(patch.location).toEqual({ x: 100.5137, y: 13.7334 });
    expect(patch.publicLocation).toEqual(publicLocationFor(row.id, { x: 100.5137, y: 13.7334 }));
    const d = distanceMeters(patch.location!, patch.publicLocation!);
    expect(d).toBeGreaterThanOrEqual(149);
    expect(d).toBeLessThanOrEqual(351);
    expect('exactLocation' in patch).toBe(false);
  });

  it('fills an empty area from the pin', () => {
    const noArea = listingRow({ area: '' });
    const pin = { lat: 13.7334, lng: 100.5137 };
    expect(buildListingPatch(noArea, { exactLocation: pin }).area).toBe('Talat Noi');
    // The editor sends the (empty) field with the pin.
    expect(buildListingPatch(noArea, { exactLocation: pin, area: '' }).area).toBe('Talat Noi');
    expect(buildListingPatch(noArea, { exactLocation: pin, area: '  ' }).area).toBe('Talat Noi');
    // Far from every known neighbourhood: falls back to the subdistrict, sent or stored.
    expect(buildListingPatch(noArea, { exactLocation: { lat: 13.9, lng: 100.7 }, subdistrict: 'Min Buri' }).area).toBe('Min Buri');
    expect(buildListingPatch(listingRow({ area: '', subdistrict: 'Min Buri' }), { exactLocation: { lat: 13.9, lng: 100.7 }, subdistrict: '' }).area).toBe(
      'Min Buri',
    );
  });

  it('never replaces an area the host typed when the pin moves', () => {
    const pin = { lat: 13.7334, lng: 100.5137 }; // Talat Noi
    expect(buildListingPatch(listingRow({ area: 'Ari' }), { exactLocation: pin }).area).toBeUndefined();
    expect(buildListingPatch(listingRow({ area: '' }), { exactLocation: pin, area: 'Riverside' }).area).toBe('Riverside');
  });

  it('rejects max nights below min nights, using stored values for the other side', () => {
    expect(() => buildListingPatch(row, { maxNights: 0 + 1, minNights: 5 })).toThrow('Maximum nights');
    expect(() => buildListingPatch(listingRow({ minNights: 10 }), { maxNights: 5 })).toThrow('Maximum nights');
    expect(buildListingPatch(listingRow({ minNights: 10 }), { maxNights: 10 })).toEqual({ maxNights: 10 });
  });
});
