import { z } from 'zod';
import type { RefundQuote } from '../cancellation';
import type { IsoDate } from '../dates';
import type {
  BookingActor,
  BookingStatus,
  CancellationPolicy,
  PaymentMethod,
  PaymentStatus,
  RoomType,
} from '../enums';
import type { Satang } from '../money';
import type { NightPrice, PriceQuote } from '../pricing';
import { isoDateSchema } from './common';
import type { PublicUserDto } from './users';

/**
 * Bookings contract. Owner: Bookings & Payments module.
 * CASL: the guest (guestId) and the host (hostId) of a booking can read it; transitions are
 * checked against BOOKING_TRANSITIONS in booking-state.ts.
 *
 *   POST /bookings/quote                    QuoteInput           -> QuoteDto
 *   POST /bookings                          CreateBookingInput   -> BookingDto  (requested, or payment_hold if instant book)
 *   GET  /bookings/mine                     MyBookingsQuery      -> BookingDto[]   (as guest)
 *   GET  /bookings/:id                      -                    -> BookingDto     (guest or host)
 *   POST /bookings/:id/approve              -                    -> BookingDto     (host: requested -> payment_hold)
 *   POST /bookings/:id/reject               RejectBookingInput   -> BookingDto     (host: requested -> rejected)
 *   GET  /bookings/:id/cancellation-quote   -                    -> RefundQuote    (for the caller's side)
 *   POST /bookings/:id/cancel               CancelBookingInput   -> BookingDto
 *
 * POST /bookings takes an optional Idempotency-Key header (IDEMPOTENCY_KEY_HEADER in common.ts):
 * a retry with the same key returns the booking the first attempt created, in whatever state it is now.
 *
 * Errors: 409 DATES_UNAVAILABLE (exclusion constraint), 409 INVALID_TRANSITION,
 *         410 HOLD_EXPIRED, 403 OWN_LISTING (guest is the host),
 *         400 VALIDATION_FAILED with details { reasons: QuoteReason[] } when the stay breaks a listing rule,
 *         422 IDEMPOTENCY_KEY_REUSED when the key was already used for a different stay.
 *
 * /bookings/mine tabs: upcoming = requested | payment_hold | confirmed with check_out >= today (Bangkok);
 * past = completed, or confirmed with check_out < today; cancelled = cancelled | rejected | expired.
 */

/** Why a stay can't be booked (QuoteDto.reasons). 'own_listing' is set when the viewer is the host. */
export const QUOTE_REASONS = [
  'min_nights',
  'max_nights',
  'max_guests',
  'unavailable',
  'advance_notice',
  'booking_window',
  'own_listing',
] as const;
export type QuoteReason = (typeof QUOTE_REASONS)[number];

export const quoteInputSchema = z
  .object({
    listingId: z.uuid(),
    checkIn: isoDateSchema,
    checkOut: isoDateSchema,
    guests: z.number().int().min(1).max(16),
  })
  .refine((v) => v.checkOut > v.checkIn, { message: 'Check-out must be after check-in', path: ['checkOut'] });
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export interface QuoteDto {
  available: boolean;
  /** Why not bookable, see QUOTE_REASONS. Empty when `available`. */
  reasons: QuoteReason[];
  quote: PriceQuote;
  instantBook: boolean;
  cancellationPolicy: CancellationPolicy;
  freeCancellationUntil: IsoDate;
}

export const createBookingInputSchema = z
  .object({
    listingId: z.uuid(),
    checkIn: isoDateSchema,
    checkOut: isoDateSchema,
    guests: z.number().int().min(1).max(16),
    /** Message to the host, required for request-to-book. */
    message: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.checkOut > v.checkIn, { message: 'Check-out must be after check-in', path: ['checkOut'] });
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

export const myBookingsQuerySchema = z.object({
  tab: z.enum(['upcoming', 'past', 'cancelled']).default('upcoming'),
});
export type MyBookingsQuery = z.infer<typeof myBookingsQuerySchema>;

export const rejectBookingInputSchema = z.object({ reason: z.string().trim().max(500).optional() });
export type RejectBookingInput = z.infer<typeof rejectBookingInputSchema>;

export const cancelBookingInputSchema = z.object({ reason: z.string().trim().min(1).max(500) });
export type CancelBookingInput = z.infer<typeof cancelBookingInputSchema>;

export interface BookingPricingDto {
  nightly: NightPrice[];
  nightsSubtotal: Satang;
  weeklyDiscount: Satang;
  nightsTotal: Satang;
  cleaningFee: Satang;
  serviceFee: Satang;
  total: Satang;
  hostFee: Satang;
  hostPayout: Satang;
  currency: 'THB';
}

/** Address and contact details, only present once the booking is confirmed. */
export interface BookingUnlockedDto {
  address: string;
  location: { lat: number; lng: number } | null;
  hostPhone: string | null;
  guestPhone: string | null;
  checkInFrom: string;
  checkOutBy: string;
}

export interface BookingDto {
  id: string;
  /** Human reference, e.g. BK-7F3K2Q */
  ref: string;
  status: BookingStatus;
  /** Who is looking: lets the UI pick guest or host wording. */
  viewerRole: 'guest' | 'host' | 'admin';
  listing: {
    id: string;
    title: string;
    coverPhotoUrl: string | null;
    area: string;
    roomType: RoomType;
    rating: number | null;
    reviewCount: number;
  };
  guest: PublicUserDto;
  host: PublicUserDto;
  checkIn: IsoDate;
  checkOut: IsoDate;
  nights: number;
  guests: number;
  pricing: BookingPricingDto;
  cancellationPolicy: CancellationPolicy;
  freeCancellationUntil: IsoDate;
  instant: boolean;
  message: string | null;
  holdExpiresAt: string | null;
  requestExpiresAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: BookingActor | null;
  cancelReason: string | null;
  refundAmount: Satang | null;
  hostPenalty: Satang | null;
  createdAt: string;
  unlocked: BookingUnlockedDto | null;
  payment: {
    status: PaymentStatus;
    method: PaymentMethod | null;
    /** Card last 4 when known. */
    last4: string | null;
    paidAt: string | null;
  } | null;
}

export type { RefundQuote };
