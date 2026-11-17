import type { BookingDto, BookingStatus, PublicUserDto } from '@hongwang/shared';
import { buildDashboard, monthStart, nextKycStatus, toOnboardingDto } from './dashboard';

// 10:00 on Thu, Dec 10 2026 in Bangkok.
const NOW = new Date('2026-12-10T03:00:00Z');
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

const person = (firstName: string, lastName: string): PublicUserDto => ({
  id: `u-${firstName}`,
  firstName,
  displayName: `${firstName} ${lastName[0]}.`,
  initials: `${firstName[0]}${lastName[0]}`,
  avatarUrl: null,
  about: null,
  identityVerified: false,
  joinedAt: '2024-01-01T00:00:00.000Z',
});

const LISTINGS = [
  { id: 'studio', title: 'Sunny studio near BTS Ari' },
  { id: 'onebed', title: 'Quiet 1-bed with balcony' },
];

let seq = 0;
function booking(
  status: BookingStatus,
  listingId: string,
  checkIn: string,
  checkOut: string,
  guest: [string, string],
  over: Partial<BookingDto> = {},
): BookingDto {
  seq += 1;
  return {
    id: over.id ?? `b${seq}`,
    ref: `BK-${seq}`,
    status,
    viewerRole: 'host',
    listing: { id: listingId, title: listingId, coverPhotoUrl: null, area: 'Ari', roomType: 'entire_place', rating: null, reviewCount: 0 },
    guest: person(...guest),
    host: person('Ploy', 'Kittisak'),
    checkIn,
    checkOut,
    nights: 3,
    guests: 2,
    pricing: {
      nightly: [],
      nightsSubtotal: 0,
      weeklyDiscount: 0,
      nightsTotal: 0,
      cleaningFee: 0,
      serviceFee: 0,
      total: 0,
      hostFee: 0,
      hostPayout: 100000,
      currency: 'THB',
    },
    cancellationPolicy: 'moderate',
    freeCancellationUntil: checkIn,
    instant: false,
    message: null,
    holdExpiresAt: null,
    requestExpiresAt: null,
    confirmedAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    refundAmount: null,
    hostPenalty: null,
    createdAt: `2026-12-0${(seq % 9) + 1}T00:00:00.000Z`,
    unlocked: null,
    payment: null,
    ...over,
  };
}

function fixture() {
  const nok = booking('confirmed', 'onebed', '2026-12-11', '2026-12-14', ['Nok', 'Prasert'], {
    id: 'nok',
    pricing: { ...booking('confirmed', 'x', '2026-12-01', '2026-12-02', ['X', 'Y']).pricing, hostPayout: 451800 },
  });
  const daniel = booking('payment_hold', 'studio', '2026-12-12', '2026-12-15', ['Daniel', 'Morris'], {
    id: 'daniel',
    holdExpiresAt: hoursFromNow(0.25),
  });
  const hana = booking('confirmed', 'studio', '2026-12-20', '2026-12-27', ['Hana', 'Kimura'], {
    id: 'hana',
    pricing: { ...nok.pricing, hostPayout: 828000 },
  });
  const done = booking('completed', 'studio', '2026-12-02', '2026-12-05', ['Mia', 'Schmidt'], {
    id: 'done',
    pricing: { ...nok.pricing, hostPayout: 300000 },
  });
  const lastMonth = booking('completed', 'studio', '2026-11-28', '2026-12-01', ['Old', 'Stay'], { id: 'nov' });
  const aom = booking('requested', 'onebed', '2026-12-18', '2026-12-21', ['Aom', 'Suk'], {
    id: 'aom',
    requestExpiresAt: hoursFromNow(19),
  });
  const lukas = booking('requested', 'onebed', '2026-12-19', '2026-12-23', ['Lukas', 'Weber'], {
    id: 'lukas',
    requestExpiresAt: hoursFromNow(22),
  });
  const stale = booking('requested', 'studio', '2026-12-28', '2026-12-30', ['Late', 'Request'], {
    id: 'stale',
    requestExpiresAt: hoursFromNow(-1),
  });
  const january = booking('confirmed', 'studio', '2027-01-05', '2027-01-08', ['Jan', 'Uary'], { id: 'jan' });
  return { nok, daniel, hana, done, lastMonth, aom, lukas, stale, january };
}

describe('buildDashboard', () => {
  const f = fixture();
  const dto = buildDashboard({
    now: NOW,
    greetingName: 'Ploy',
    listings: LISTINGS,
    blocks: [{ listingId: 'studio', date: '2026-12-18' }],
    bookings: [f.lukas, f.january, f.hana, f.done, f.lastMonth, f.aom, f.stale, f.daniel, f.nok],
  });

  it('lists open requests, soonest expiry first, and skips expired ones', () => {
    expect(dto.pendingRequests.map((b) => b.id)).toEqual(['aom', 'lukas']);
    expect(dto.oldestRequestExpiresAt).toBe(f.aom.requestExpiresAt);
  });

  it('counts arrivals in the next 7 days, confirmed or on payment hold', () => {
    expect(dto.arrivingSoon.count).toBe(2);
    expect(dto.arrivingSoon.bookings.map((b) => b.id)).toEqual(['nok', 'daniel']);
  });

  it('picks the earliest confirmed stay from today for the next payout, released 1 day after check-in', () => {
    expect(dto.nextPayout).toEqual({ amount: 451800, date: '2026-12-12', guestName: 'Nok' });
  });

  it('sums confirmed and completed payouts checking in this Bangkok month', () => {
    // nok 4,518 + hana 8,280 + completed 3,000; November and January stays don't count.
    expect(dto.monthToDate).toEqual({ amount: 451800 + 828000 + 300000, confirmedCount: 3, onHoldCount: 1 });
  });

  it('lists upcoming confirmed and held stays by check-in', () => {
    expect(dto.upcoming.map((b) => b.id)).toEqual(['nok', 'daniel', 'hana', 'jan']);
  });

  it('builds a 14-day timeline per listing from today', () => {
    expect(dto.timeline).toHaveLength(2);
    const [studio, onebed] = dto.timeline;
    expect(studio!.days).toHaveLength(14);
    expect(studio!.days[0]!.date).toBe('2026-12-10');
    expect(studio!.days[13]!.date).toBe('2026-12-23');
    expect(studio!.days.map((d) => d.state)).toEqual([
      'open', 'open', 'payment_hold', 'payment_hold', 'payment_hold', 'open', 'open',
      'open', 'blocked', 'open', 'booked', 'booked', 'booked', 'booked',
    ]);
    expect(studio!.days[2]).toMatchObject({ bookingId: 'daniel', guestName: 'Daniel M.' });
    expect(onebed!.days.map((d) => d.state)).toEqual([
      'open', 'booked', 'booked', 'booked', 'open', 'open', 'open',
      // Aom asks for the nights of 18-20, Lukas for 19-22; check-out day 23 is open again.
      'open', 'requested', 'requested', 'requested', 'requested', 'requested', 'open',
    ]);
  });

  it('carries greeting and listing count', () => {
    expect(dto.greetingName).toBe('Ploy');
    expect(dto.listingCount).toBe(2);
  });

  it('handles a brand-new host', () => {
    const empty = buildDashboard({ now: NOW, greetingName: 'Arthit', listings: [], blocks: [], bookings: [] });
    expect(empty).toMatchObject({
      pendingRequests: [],
      oldestRequestExpiresAt: null,
      arrivingSoon: { count: 0, bookings: [] },
      nextPayout: null,
      monthToDate: { amount: 0, confirmedCount: 0, onHoldCount: 0 },
      upcoming: [],
      timeline: [],
      listingCount: 0,
    });
  });

  it('uses the Bangkok date, not UTC, for "today"', () => {
    // 18:30 UTC on Dec 9 is already 01:30 on Dec 10 in Bangkok.
    const late = buildDashboard({ now: new Date('2026-12-09T18:30:00Z'), greetingName: 'P', listings: LISTINGS, blocks: [], bookings: [] });
    expect(late.timeline[0]!.days[0]!.date).toBe('2026-12-10');
  });
});

describe('monthStart', () => {
  it('is the first of the month', () => {
    expect(monthStart('2026-12-10')).toBe('2026-12-01');
  });
});

describe('onboarding', () => {
  it('derives the steps from the user row', () => {
    expect(toOnboardingDto({ hostProfile: null, kycStatus: 'none', stripeAccountId: null })).toEqual({
      relation: null,
      roomCount: null,
      kycStatus: 'none',
      payoutsConnected: false,
      steps: { about: false, identity: false, payouts: false },
    });
    expect(
      toOnboardingDto({ hostProfile: { relation: 'owner', roomCount: '2-5' }, kycStatus: 'pending', stripeAccountId: 'acct_1' }),
    ).toMatchObject({ steps: { about: true, identity: true, payouts: true }, payoutsConnected: true });
    expect(toOnboardingDto({ hostProfile: { relation: 'owner' }, kycStatus: 'rejected', stripeAccountId: null }).steps).toEqual({
      about: false,
      identity: false,
      payouts: false,
    });
  });

  it('moves KYC to pending, or verified with auto-approve, and never downgrades', () => {
    expect(nextKycStatus('none', false)).toBe('pending');
    expect(nextKycStatus('rejected', false)).toBe('pending');
    expect(nextKycStatus('none', true)).toBe('verified');
    expect(nextKycStatus('verified', false)).toBe('verified');
  });
});
