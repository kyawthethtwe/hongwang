import { z } from 'zod';
import {
  AMENITIES,
  CANCELLATION_POLICIES,
  PROPERTY_TYPES,
  ROOM_TYPES,
  type Amenity,
  type CancellationPolicy,
  type ListingStatus,
  type PropertyType,
  type RoomType,
} from '../enums';
import type { IsoDate } from '../dates';
import type { Satang } from '../money';
import { isoDateSchema, satangSchema } from './common';
import type { PublicUserDto } from './users';

/**
 * Listings contract. Owner: Listings & Search module.
 *
 * Public:
 *   GET    /listings/:id                       -                     -> ListingDetailDto (published; owner/admin see any)
 *   GET    /listings/:id/availability          AvailabilityQuery     -> AvailabilityDto (max 400 nights per call)
 * Host (owner only, CASL 'update' on Listing):
 *   GET    /listings/mine                      -                     -> HostListingSummaryDto[]
 *   POST   /listings                           CreateListingInput    -> HostListingDto (draft)
 *   GET    /listings/:id/edit                  -                     -> HostListingDto
 *   PATCH  /listings/:id                       UpdateListingInput    -> HostListingDto
 *   POST   /listings/:id/submit                -                     -> HostListingDto (in_review, or published if AUTO_APPROVE_LISTINGS)
 *   POST   /listings/:id/pause                 -                     -> HostListingDto
 *   POST   /listings/:id/unpause               -                     -> HostListingDto
 *   DELETE /listings/:id                       -                     -> 204 (drafts only; soft delete)
 *   POST   /listings/:id/photos/upload-url     PhotoUploadInput      -> UploadTarget
 *   POST   /listings/:id/photos                AttachPhotoInput      -> ListingPhotoDto
 *   PATCH  /listings/:id/photos/:photoId       UpdatePhotoInput      -> ListingPhotoDto
 *   PUT    /listings/:id/photos/order          ReorderPhotosInput    -> ListingPhotoDto[]
 *   DELETE /listings/:id/photos/:photoId       -                     -> 204
 *
 * Notes for the editor (design C4):
 * - PATCH is partial; send one section at a time. When `exactLocation` changes the API recomputes the
 *   public (approximate) pin, and fills `area` from the nearest known neighbourhood if the listing
 *   has none (an empty `area` in the same save counts as none). A typed area is never replaced.
 *   The editor edits `HostListingDto.storedArea`, not the display `area`.
 * - Photo upload: POST upload-url -> PUT the file to `uploadUrl` with `headers` -> POST photos { key }.
 *   Up to MAX_LISTING_PHOTOS per listing; position 0 is the cover.
 * - Submit needs every LISTING_EDITOR_SECTIONS entry complete (see `completeness`) and at least
 *   MIN_LISTING_PHOTOS photos, from draft / rejected. Errors: 400 VALIDATION_FAILED with
 *   `details: { missing: ListingEditorSection[] }`, 409 INVALID_TRANSITION from other statuses.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface TransitInfo {
  /** e.g. "BTS Ari" */
  station: string;
  walkMinutes: number;
}

export interface HouseRules {
  smoking: boolean;
  pets: boolean;
  events: boolean;
  notes: string | null;
}

export interface ListingPhotoDto {
  id: string;
  url: string;
  caption: string | null;
  position: number;
  width: number | null;
  height: number | null;
}

/** Card in search results, saved list, map pins. */
export interface ListingSummaryDto {
  id: string;
  title: string;
  roomType: RoomType;
  propertyType: PropertyType;
  /** Neighbourhood shown to guests, e.g. "Ari" */
  area: string;
  transit: TransitInfo | null;
  basePrice: Satang;
  /** Nights total for the searched dates (overrides + weekly discount), when dates were given. */
  stayTotal: Satang | null;
  rating: number | null;
  reviewCount: number;
  instantBook: boolean;
  coverPhotoUrl: string | null;
  /** Public (approximate) location, never the exact address. */
  location: LatLng;
  maxGuests: number;
}

export interface ListingDetailDto extends ListingSummaryDto {
  description: string;
  status: ListingStatus;
  sizeSqm: number | null;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  floor: number | null;
  amenities: Amenity[];
  photos: ListingPhotoDto[];
  host: PublicUserDto & { hostingSince: string };
  cleaningFee: Satang;
  weeklyDiscountPct: number;
  minNights: number;
  maxNights: number;
  advanceNoticeDays: number;
  bookingWindowMonths: number;
  checkInFrom: string; // 'HH:MM'
  checkOutBy: string; // 'HH:MM'
  cancellationPolicy: CancellationPolicy;
  houseRules: HouseRules;
  subdistrict: string | null;
  district: string | null;
  province: string;
}

export const availabilityQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export interface AvailabilityDto {
  /** Nights that can't be booked (held/booked by others, blocked by host, inside advance notice). */
  unavailable: IsoDate[];
  /** Nightly price for every date in [from, to) (base price or the host's special price). */
  prices: Record<IsoDate, Satang>;
  minNights: number;
  maxNights: number;
}

/** Host-side listing, includes the exact address. */
export interface HostListingDto extends Omit<ListingDetailDto, 'host'> {
  hostId: string;
  /** The area as saved, '' when none is set (`area` then shows a fallback such as the subdistrict). */
  storedArea: string;
  addressLine: string | null;
  postcode: string | null;
  exactLocation: LatLng | null;
  nearestStation: string | null;
  stationWalkMinutes: number | null;
  /** Which editor sections are complete, see LISTING_EDITOR_SECTIONS. */
  completeness: Record<ListingEditorSection, boolean>;
  canSubmit: boolean;
  reviewNote: string | null;
  updatedAt: string;
  publishedAt: string | null;
  submittedAt: string | null;
}

export interface HostListingSummaryDto {
  id: string;
  title: string;
  status: ListingStatus;
  coverPhotoUrl: string | null;
  area: string;
  basePrice: Satang;
  instantBook: boolean;
  rating: number | null;
  reviewCount: number;
  /** Confirmed or payment-hold bookings that check in today or later. */
  upcomingBookings: number;
  updatedAt: string;
  reviewNote: string | null;
  /** Requests waiting for the host's answer. */
  pendingRequests: number;
  /** Next confirmed / held arrival, e.g. { name: 'Daniel M.', checkIn: '2026-12-12' }. */
  nextGuest: { name: string; checkIn: IsoDate } | null;
  submittedAt: string | null;
  /** Editor sections still to do (design C3 "3 steps left: photos, pricing ..."). */
  missingSections: ListingEditorSection[];
  photoCount: number;
}

/** Listing editor steps (design C4). */
export const LISTING_EDITOR_SECTIONS = [
  'basics',
  'location',
  'photos',
  'amenities',
  'pricing',
  'availability',
  'policies',
] as const;
export type ListingEditorSection = (typeof LISTING_EDITOR_SECTIONS)[number];
export const LISTING_EDITOR_SECTION_LABELS: Record<ListingEditorSection, string> = {
  basics: 'Basics',
  location: 'Location',
  photos: 'Photos',
  amenities: 'Amenities',
  pricing: 'Pricing',
  availability: 'Availability',
  policies: 'Rules and policy',
};

export const MIN_LISTING_PHOTOS = 5;
export const MAX_LISTING_PHOTOS = 30;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');

export const createListingInputSchema = z.object({
  title: z.string().trim().max(60).optional(),
  roomType: z.enum(ROOM_TYPES).optional(),
});
export type CreateListingInput = z.infer<typeof createListingInputSchema>;

/** Every field optional: the editor saves one section at a time. */
export const updateListingInputSchema = z.object({
  // basics
  title: z.string().trim().min(1).max(60),
  roomType: z.enum(ROOM_TYPES),
  propertyType: z.enum(PROPERTY_TYPES),
  sizeSqm: z.number().int().min(5).max(2000).nullable(),
  maxGuests: z.number().int().min(1).max(16),
  bedrooms: z.number().int().min(0).max(20),
  beds: z.number().int().min(1).max(30),
  bathrooms: z.number().min(0).max(20).multipleOf(0.5),
  floor: z.number().int().min(-5).max(200).nullable(),
  description: z.string().trim().max(4000),
  // location
  addressLine: z.string().trim().max(200),
  subdistrict: z.string().trim().max(100),
  district: z.string().trim().max(100),
  province: z.string().trim().max(100),
  postcode: z.string().regex(/^\d{5}$/),
  exactLocation: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  area: z.string().trim().max(60),
  nearestStation: z.string().trim().max(80).nullable(),
  stationWalkMinutes: z.number().int().min(0).max(120).nullable(),
  // amenities
  amenities: z.array(z.enum(AMENITIES)).max(AMENITIES.length),
  // pricing
  basePrice: satangSchema.min(10000), // at least ฿100
  cleaningFee: satangSchema,
  weeklyDiscountPct: z.number().int().min(0).max(80),
  // availability
  instantBook: z.boolean(),
  minNights: z.number().int().min(1).max(365),
  maxNights: z.number().int().min(1).max(365),
  advanceNoticeDays: z.number().int().min(0).max(7),
  bookingWindowMonths: z.union([z.literal(3), z.literal(6), z.literal(12)]),
  checkInFrom: hhmm,
  checkOutBy: hhmm,
  // policies
  cancellationPolicy: z.enum(CANCELLATION_POLICIES),
  houseRules: z.object({
    smoking: z.boolean(),
    pets: z.boolean(),
    events: z.boolean(),
    notes: z.string().trim().max(1000).nullable(),
  }),
}).partial();
export type UpdateListingInput = z.infer<typeof updateListingInputSchema>;

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;

export const photoUploadInputSchema = z.object({
  contentType: z.enum(PHOTO_CONTENT_TYPES),
  size: z.number().int().positive().max(MAX_PHOTO_BYTES),
  fileName: z.string().max(200).optional(),
});
export type PhotoUploadInput = z.infer<typeof photoUploadInputSchema>;

export const attachPhotoInputSchema = z.object({
  key: z.string().min(1).max(500),
  caption: z.string().trim().max(140).nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});
export type AttachPhotoInput = z.infer<typeof attachPhotoInputSchema>;

export const updatePhotoInputSchema = z.object({ caption: z.string().trim().max(140).nullable() });
export type UpdatePhotoInput = z.infer<typeof updatePhotoInputSchema>;

export const reorderPhotosInputSchema = z.object({ photoIds: z.array(z.uuid()).min(1).max(100) });
export type ReorderPhotosInput = z.infer<typeof reorderPhotosInputSchema>;
