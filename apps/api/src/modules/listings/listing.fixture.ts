import type { ListingRow, PhotoRow, UserRow } from './listing.mappers';

/** Test fixtures (not a spec): a complete, published listing like the seed's "Sunny studio". */
export function listingRow(over: Partial<ListingRow> = {}): ListingRow {
  const now = new Date('2026-11-10T03:00:00Z');
  return {
    id: '7d1f7c2e-4a7b-4f3e-9a51-1c2d3e4f5a6b',
    hostId: '11111111-1111-4111-8111-111111111111',
    status: 'published',
    title: 'Sunny studio near BTS Ari',
    description: 'A bright corner studio a short walk from BTS Ari.',
    roomType: 'entire_place',
    propertyType: 'condo',
    sizeSqm: 28,
    maxGuests: 2,
    bedrooms: 1,
    beds: 1,
    bathrooms: 1,
    floor: 9,
    addressLine: '[FULL ADDRESS 1]',
    subdistrict: 'Samsen Nai',
    district: 'Phaya Thai',
    province: 'Bangkok',
    postcode: '10400',
    area: 'Ari',
    location: { x: 100.5452, y: 13.7801 },
    publicLocation: { x: 100.5468, y: 13.7815 },
    nearestStation: 'BTS Ari',
    stationWalkMinutes: 4,
    amenities: ['wifi', 'air_conditioning'],
    basePrice: 120000,
    cleaningFee: 30000,
    weeklyDiscountPct: 10,
    instantBook: true,
    minNights: 1,
    maxNights: 90,
    advanceNoticeDays: 0,
    bookingWindowMonths: 12,
    checkInFrom: '14:00',
    checkOutBy: '11:00',
    cancellationPolicy: 'moderate',
    houseRules: { smoking: false, pets: false, events: false, notes: null },
    ratingAvg: 4.92,
    reviewCount: 38,
    reviewNote: null,
    submittedAt: now,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...over,
  };
}

export function photoRows(listingId: string, n: number): PhotoRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    listingId,
    storageKey: `listings/${listingId}/photo-${i}.jpg`,
    url: `http://localhost:4000/uploads/listings/${listingId}/photo-${i}.jpg`,
    caption: i === 0 ? 'Main room' : null,
    position: n - 1 - i, // stored out of order on purpose
    width: 1600,
    height: 1067,
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, i)),
  }));
}

export function userRow(over: Partial<UserRow> = {}): UserRow {
  const created = new Date('2023-04-01T00:00:00Z');
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'ploy@hongwang.local',
    passwordHash: 'hash',
    firstName: 'Ploy',
    lastName: 'Kittisak',
    phone: '+66811110001',
    emailVerifiedAt: created,
    phoneVerifiedAt: created,
    googleId: null,
    avatarUrl: null,
    about: 'Designer',
    role: 'user',
    kycStatus: 'verified',
    hostProfile: null,
    stripeAccountId: null,
    stripeCustomerId: null,
    lineOptIn: false,
    locale: 'en',
    currency: 'THB',
    timezone: 'Asia/Bangkok',
    passwordChangedAt: null,
    suspendedAt: null,
    deletedAt: null,
    createdAt: created,
    updatedAt: created,
    ...over,
  };
}
