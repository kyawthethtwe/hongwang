import { MIN_LISTING_PHOTOS } from '@hongwang/shared';
import { isComplete, listingCompleteness, missingSections } from './completeness';
import { listingRow } from './listing.fixture';

describe('listingCompleteness', () => {
  it('is complete for a full listing with enough photos', () => {
    const c = listingCompleteness(listingRow(), MIN_LISTING_PHOTOS);
    expect(missingSections(c)).toEqual([]);
    expect(isComplete(c)).toBe(true);
  });

  it('needs at least MIN_LISTING_PHOTOS photos', () => {
    expect(listingCompleteness(listingRow(), MIN_LISTING_PHOTOS - 1).photos).toBe(false);
  });

  it('flags a fresh draft (defaults) as missing basics, location, photos, amenities and pricing', () => {
    const draft = listingRow({
      status: 'draft',
      title: '',
      description: '',
      addressLine: null,
      subdistrict: null,
      district: null,
      postcode: null,
      area: '',
      location: null,
      publicLocation: null,
      amenities: [],
      basePrice: 0,
    });
    expect(missingSections(listingCompleteness(draft, 0))).toEqual(['basics', 'location', 'photos', 'amenities', 'pricing']);
  });

  it('checks each location field', () => {
    expect(listingCompleteness(listingRow({ postcode: '104' }), 5).location).toBe(false);
    expect(listingCompleteness(listingRow({ location: null }), 5).location).toBe(false);
    expect(listingCompleteness(listingRow({ addressLine: '  ' }), 5).location).toBe(false);
  });

  it('needs a price of at least ฿100', () => {
    expect(listingCompleteness(listingRow({ basePrice: 9_900 }), 5).pricing).toBe(false);
    expect(listingCompleteness(listingRow({ basePrice: 10_000 }), 5).pricing).toBe(true);
  });

  it('checks availability consistency', () => {
    expect(listingCompleteness(listingRow({ minNights: 5, maxNights: 3 }), 5).availability).toBe(false);
    expect(listingCompleteness(listingRow({ checkInFrom: '25:00' }), 5).availability).toBe(false);
  });
});
