import { z } from 'zod';
import type { IsoDate } from '../dates';
import type { BookingStatus } from '../enums';
import type { Satang } from '../money';
import type { BookingDto } from './bookings';
import { isoDateSchema, satangSchema } from './common';

/**
 * Host contract. Owner: Host Dashboard module. Every endpoint is scoped to listings the caller owns.
 *
 *   GET  /host/dashboard                          -                     -> HostDashboardDto
 *   GET  /host/reservations                       HostReservationsQuery -> BookingDto[]
 *   GET  /host/calendar                           HostCalendarQuery     -> HostCalendarDto
 *   PUT  /host/calendar/:listingId/blocks         SetBlocksInput        -> HostCalendarDto (409 DATES_UNAVAILABLE if a night is booked)
 *   PUT  /host/calendar/:listingId/prices         SetPricesInput        -> HostCalendarDto
 *   GET  /host/onboarding                         -                     -> HostOnboardingDto
 *   PUT  /host/onboarding                         HostOnboardingInput   -> HostOnboardingDto
 *   POST /host/onboarding/identity                HostIdentityInput     -> HostOnboardingDto
 *        Records that the host started the ID check: kyc_status 'pending' ('verified' straight away
 *        when AUTO_APPROVE_LISTINGS is on). Document upload and review by the trust team are phase 2.
 *
 * Day states, strongest first: booked (confirmed/completed) > payment_hold > blocked > requested > open.
 *
 * Approve / reject / cancel are the Bookings endpoints (/bookings/:id/approve etc.).
 * Listing CRUD is the Listings endpoints (/listings/mine, /listings/:id/edit, ...).
 */

export type CalendarDayState = 'open' | 'blocked' | 'requested' | 'payment_hold' | 'booked';

export interface HostCalendarDay {
  date: IsoDate;
  state: CalendarDayState;
  price: Satang;
  /** True when price is a host special price for this date. */
  isSpecialPrice: boolean;
  bookingId: string | null;
  guestName: string | null;
  /** True on the first night of a booking (to draw the guest label once). */
  isBookingStart: boolean;
  isPast: boolean;
}

export const hostCalendarQuerySchema = z.object({
  listingId: z.uuid(),
  /** 'YYYY-MM' */
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});
export type HostCalendarQuery = z.infer<typeof hostCalendarQuerySchema>;

/** Path params of PUT /host/calendar/:listingId/blocks and /prices. */
export const hostCalendarListingParamSchema = z.object({ listingId: z.uuid() });
export type HostCalendarListingParam = z.infer<typeof hostCalendarListingParamSchema>;

export interface HostCalendarDto {
  listing: {
    id: string;
    title: string;
    basePrice: Satang;
    cleaningFee: Satang;
    minNights: number;
    instantBook: boolean;
  };
  month: string;
  days: HostCalendarDay[];
}

export const setBlocksInputSchema = z.object({
  dates: z.array(isoDateSchema).min(1).max(366),
  blocked: z.boolean(),
});
export type SetBlocksInput = z.infer<typeof setBlocksInputSchema>;

export const setPricesInputSchema = z.object({
  dates: z.array(isoDateSchema).min(1).max(366),
  /** null resets to the base price. */
  price: satangSchema.min(10000).nullable(),
});
export type SetPricesInput = z.infer<typeof setPricesInputSchema>;

export const hostReservationsQuerySchema = z.object({
  status: z
    .enum(['requested', 'payment_hold', 'confirmed', 'completed', 'cancelled', 'upcoming', 'all'])
    .default('upcoming'),
  listingId: z.uuid().optional(),
});
export type HostReservationsQuery = z.infer<typeof hostReservationsQuerySchema>;

export interface HostTimelineRow {
  listingId: string;
  title: string;
  days: { date: IsoDate; state: CalendarDayState; bookingId: string | null; guestName: string | null }[];
}

export interface HostDashboardDto {
  greetingName: string;
  pendingRequests: BookingDto[];
  /** Oldest request's expiry, to show "Oldest expires in 19 h". */
  oldestRequestExpiresAt: string | null;
  arrivingSoon: { count: number; bookings: BookingDto[] };
  nextPayout: { amount: Satang; date: IsoDate; guestName: string } | null;
  monthToDate: { amount: Satang; confirmedCount: number; onHoldCount: number };
  upcoming: BookingDto[];
  /** Next 14 days for every listing (design C2 "Next two weeks"). */
  timeline: HostTimelineRow[];
  listingCount: number;
}

export const HOST_RELATIONS = ['owner', 'manager', 'subletting'] as const;
export const HOST_ROOM_COUNTS = ['1', '2-5', '6+'] as const;

export const HOST_RELATION_LABELS: Record<(typeof HOST_RELATIONS)[number], string> = {
  owner: 'I own it',
  manager: 'I manage it for the owner',
  subletting: 'I rent it and my lease allows subletting',
};
export const HOST_ROOM_COUNT_LABELS: Record<(typeof HOST_ROOM_COUNTS)[number], string> = {
  '1': '1',
  '2-5': '2 to 5',
  '6+': '6 or more',
};

export const hostOnboardingInputSchema = z.object({
  relation: z.enum(HOST_RELATIONS),
  roomCount: z.enum(HOST_ROOM_COUNTS),
});
export type HostOnboardingInput = z.infer<typeof hostOnboardingInputSchema>;

export interface HostOnboardingDto {
  relation: (typeof HOST_RELATIONS)[number] | null;
  roomCount: (typeof HOST_ROOM_COUNTS)[number] | null;
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';
  payoutsConnected: boolean;
  steps: { about: boolean; identity: boolean; payouts: boolean };
}

export const HOST_ID_DOCUMENTS = ['national_id', 'passport'] as const;
export type HostIdDocument = (typeof HOST_ID_DOCUMENTS)[number];
export const HOST_ID_DOCUMENT_LABELS: Record<HostIdDocument, string> = {
  national_id: 'Thai national ID card',
  passport: 'Passport',
};

export const hostIdentityInputSchema = z.object({ documentType: z.enum(HOST_ID_DOCUMENTS) });
export type HostIdentityInput = z.infer<typeof hostIdentityInputSchema>;

export type { BookingStatus };
