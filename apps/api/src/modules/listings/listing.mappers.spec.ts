import { photoRows, listingRow, userRow } from './listing.fixture';
import { shortGuestName, toHostListing, toHostListingSummary, toListingDetail, toListingSummary } from './listing.mappers';

describe('listing mappers', () => {
  const row = listingRow();
  const photos = photoRows(row.id, 5);

  it('summary uses the public pin and never the exact one', () => {
    const s = toListingSummary(row, null);
    expect(s.location).toEqual({ lat: 13.7815, lng: 100.5468 });
    expect(s.transit).toEqual({ station: 'BTS Ari', walkMinutes: 4 });
    expect(s.rating).toBe(4.92);
    expect(s.stayTotal).toBeNull();
  });

  it('detail hides the address, postcode and exact location', () => {
    const d = toListingDetail(row, photos, userRow());
    const json = JSON.stringify(d);
    expect(json).not.toContain('FULL ADDRESS');
    expect(json).not.toContain('10400');
    expect(json).not.toContain('100.5452');
    expect(json).not.toContain('ploy@hongwang.local');
    expect(json).not.toContain('+66811110001');
    expect(d).not.toHaveProperty('addressLine');
    expect(d).not.toHaveProperty('exactLocation');
  });

  it('detail sorts photos by position and uses the first as cover', () => {
    const d = toListingDetail(row, photos, userRow());
    expect(d.photos.map((p) => p.position)).toEqual([0, 1, 2, 3, 4]);
    expect(d.coverPhotoUrl).toBe(d.photos[0]!.url);
  });

  it('detail host is public info plus hosting since', () => {
    const d = toListingDetail(row, [], userRow());
    expect(d.host).toMatchObject({ firstName: 'Ploy', displayName: 'Ploy K.', initials: 'PK', identityVerified: true, hostingSince: '2023-04-01T00:00:00.000Z' });
    expect(d.coverPhotoUrl).toBeNull();
  });

  it('host DTO includes the exact address and completeness', () => {
    const h = toHostListing(listingRow({ status: 'draft' }), photos);
    expect(h.addressLine).toBe('[FULL ADDRESS 1]');
    expect(h.exactLocation).toEqual({ lat: 13.7801, lng: 100.5452 });
    expect(h.completeness.photos).toBe(true);
    expect(h.canSubmit).toBe(true);
  });

  it('host DTO cannot submit a live listing or one with too few photos', () => {
    expect(toHostListing(row, photos).canSubmit).toBe(false);
    expect(toHostListing(listingRow({ status: 'draft' }), photos.slice(0, 2)).canSubmit).toBe(false);
  });

  it('host summary lists missing sections and stats', () => {
    const s = toHostListingSummary(listingRow({ status: 'draft', basePrice: 0 }), photos.slice(0, 3), {
      upcomingBookings: 1,
      pendingRequests: 2,
      nextGuest: { name: 'Daniel M.', checkIn: '2026-12-12' },
    });
    expect(s.missingSections).toEqual(['photos', 'pricing']);
    expect(s.photoCount).toBe(3);
    expect(s.pendingRequests).toBe(2);
    expect(s.nextGuest).toEqual({ name: 'Daniel M.', checkIn: '2026-12-12' });
    expect(s.coverPhotoUrl).toContain('photo-2'); // position 0
  });

  it('shortGuestName', () => {
    expect(shortGuestName('Daniel', 'Morris')).toBe('Daniel M.');
    expect(shortGuestName('Nok', '')).toBe('Nok');
  });
});
