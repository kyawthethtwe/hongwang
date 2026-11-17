import {
  addDays,
  todayInBangkok,
  type BookingDto,
  type BookingStatus,
  type HostDashboardDto,
  type HostOnboardingDto,
  type IsoDate,
  type KycStatus,
} from '@hongwang/shared';
import type { HostProfile } from '../../database/schema';
import { buildDayStates, dateRange, type StayLike } from './day-states';

/** Days shown in the "Next two weeks" timeline. */
export const TIMELINE_DAYS = 14;
/** "Arriving in the next 7 days": check-in from today up to 6 days ahead. */
export const ARRIVING_WINDOW_DAYS = 7;
export const UPCOMING_LIMIT = 10;

/** Statuses the dashboard needs. Load bookings in these with check_out >= dashboardSince(today). */
export const DASHBOARD_STATUSES = ['requested', 'payment_hold', 'confirmed', 'completed'] as const satisfies readonly BookingStatus[];

/** First day of the Bangkok month of `today`: month-to-date needs stays from there on. */
export const monthStart = (today: IsoDate) => `${today.slice(0, 7)}-01`;

export interface DashboardInput {
  now: Date;
  greetingName: string;
  /** The host's listings (not deleted), in display order. */
  listings: { id: string; title: string }[];
  /** Blocked nights of those listings within the timeline. */
  blocks: { listingId: string; date: IsoDate }[];
  /** The host's bookings in DASHBOARD_STATUSES with check_out >= monthStart(today). */
  bookings: BookingDto[];
}

const byCheckIn = (a: BookingDto, b: BookingDto) => a.checkIn.localeCompare(b.checkIn) || a.createdAt.localeCompare(b.createdAt);
const time = (iso: string | null) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);

export function toStay(b: BookingDto): StayLike {
  return { id: b.id, status: b.status, checkIn: b.checkIn, checkOut: b.checkOut, guestName: b.guest.displayName };
}

/** Pure aggregation behind GET /host/dashboard (design C2). */
export function buildDashboard(input: DashboardInput): HostDashboardDto {
  const { now, bookings } = input;
  const today = todayInBangkok(now);
  const nowMs = now.getTime();
  const month = today.slice(0, 7);
  const arrivingUntil = addDays(today, ARRIVING_WINDOW_DAYS);

  // Requests still open, the one expiring first on top. Rows past their expiry are waiting for
  // the sweep and can't be approved any more, so they're left out.
  const pendingRequests = bookings
    .filter((b) => b.status === 'requested' && time(b.requestExpiresAt) > nowMs)
    .sort((a, b) => time(a.requestExpiresAt) - time(b.requestExpiresAt));

  const live = bookings.filter((b) => b.status === 'confirmed' || b.status === 'payment_hold');
  const arriving = live.filter((b) => b.checkIn >= today && b.checkIn < arrivingUntil).sort(byCheckIn);

  const nextStay = bookings.filter((b) => b.status === 'confirmed' && b.checkIn >= today).sort(byCheckIn)[0];

  const inMonth = bookings.filter((b) => b.checkIn.startsWith(month));
  const earned = inMonth.filter((b) => b.status === 'confirmed' || b.status === 'completed');

  const upcoming = live.filter((b) => b.checkOut >= today).sort(byCheckIn).slice(0, UPCOMING_LIMIT);

  const dates = dateRange(today, TIMELINE_DAYS);
  const timeline = input.listings.map((l) => {
    const stays = bookings.filter((b) => b.listing.id === l.id).map(toStay);
    const blocked = input.blocks.filter((x) => x.listingId === l.id).map((x) => x.date);
    return {
      listingId: l.id,
      title: l.title,
      days: buildDayStates(dates, stays, blocked).map(({ date, state, bookingId, guestName }) => ({
        date,
        state,
        bookingId,
        guestName,
      })),
    };
  });

  return {
    greetingName: input.greetingName,
    pendingRequests,
    oldestRequestExpiresAt: pendingRequests[0]?.requestExpiresAt ?? null,
    arrivingSoon: { count: arriving.length, bookings: arriving },
    nextPayout: nextStay
      ? { amount: nextStay.pricing.hostPayout, date: addDays(nextStay.checkIn, 1), guestName: nextStay.guest.firstName }
      : null,
    monthToDate: {
      amount: earned.reduce((s, b) => s + b.pricing.hostPayout, 0),
      confirmedCount: earned.length,
      onHoldCount: inMonth.filter((b) => b.status === 'payment_hold').length,
    },
    upcoming,
    timeline,
    listingCount: input.listings.length,
  };
}

/** GET /host/onboarding from the user row. */
export function toOnboardingDto(u: {
  hostProfile: HostProfile | null;
  kycStatus: KycStatus;
  stripeAccountId: string | null;
}): HostOnboardingDto {
  const relation = u.hostProfile?.relation ?? null;
  const roomCount = u.hostProfile?.roomCount ?? null;
  const payoutsConnected = !!u.stripeAccountId;
  return {
    relation,
    roomCount,
    kycStatus: u.kycStatus,
    payoutsConnected,
    steps: {
      about: !!relation && !!roomCount,
      identity: u.kycStatus === 'pending' || u.kycStatus === 'verified',
      payouts: payoutsConnected,
    },
  };
}

/** KYC status after the host submits the ID step (real document review is phase 2). */
export function nextKycStatus(current: KycStatus, autoApprove: boolean): KycStatus {
  if (current === 'verified') return 'verified';
  return autoApprove ? 'verified' : 'pending';
}
