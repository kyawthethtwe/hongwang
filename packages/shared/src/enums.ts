/**
 * Domain enums. The Postgres enums in apps/api/src/database/schema mirror these arrays exactly,
 * so change both together.
 */

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Host identity check (KYC). Publishing needs `verified` unless AUTO_APPROVE_LISTINGS is on. */
export const KYC_STATUSES = ['none', 'pending', 'verified', 'rejected'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const LISTING_STATUSES = ['draft', 'in_review', 'published', 'paused', 'rejected'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ROOM_TYPES = ['entire_place', 'private_room', 'shared_room'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  entire_place: 'Entire place',
  private_room: 'Private room',
  shared_room: 'Shared room',
};

export const PROPERTY_TYPES = ['condo', 'apartment', 'house', 'townhouse', 'shophouse'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  condo: 'Condo',
  apartment: 'Apartment',
  house: 'House',
  townhouse: 'Townhouse',
  shophouse: 'Shophouse',
};

export const CANCELLATION_POLICIES = ['flexible', 'moderate', 'strict'] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];

/** Booking lifecycle, see booking-state.ts and docs/architecture.md. */
export const BOOKING_STATUSES = [
  'requested',
  'payment_hold',
  'confirmed',
  'completed',
  'rejected',
  'expired',
  'cancelled',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_ACTORS = ['guest', 'host', 'admin', 'system'] as const;
export type BookingActor = (typeof BOOKING_ACTORS)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'cancelled',
  'refunded',
  'partially_refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['card', 'promptpay', 'mobile_banking'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const AMENITIES = [
  'wifi',
  'air_conditioning',
  'workspace',
  'kitchen',
  'washer',
  'pool',
  'gym',
  'parking',
  'tv',
  'balcony',
  'elevator',
  'keycard_access',
  'hot_water',
  'fridge',
] as const;
export type Amenity = (typeof AMENITIES)[number];
export const AMENITY_LABELS: Record<Amenity, string> = {
  wifi: 'Fibre Wi-Fi',
  air_conditioning: 'Air-con',
  workspace: 'Dedicated desk',
  kitchen: 'Kitchen',
  washer: 'Washer',
  pool: 'Pool',
  gym: 'Gym',
  parking: 'Parking',
  tv: 'TV',
  balcony: 'Balcony',
  elevator: 'Lift',
  keycard_access: '24-hour keycard access',
  hot_water: 'Hot water',
  fridge: 'Fridge',
};

export const NOTIFICATION_CHANNELS = ['email', 'line', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
