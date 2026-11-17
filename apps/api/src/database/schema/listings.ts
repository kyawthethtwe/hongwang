import type { Amenity, HouseRules } from '@hongwang/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { cancellationPolicyEnum, listingStatusEnum, propertyTypeEnum, roomTypeEnum } from './enums';
import { createdAt, point, tstz, updatedAt } from './types';
import { users } from './users';

/**
 * A rentable room or place. Money columns are satang. `location` is the exact front door
 * (only revealed once a booking is confirmed); `public_location` is offset ~300 m and is what
 * search and the map use.
 */
export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    hostId: uuid('host_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: listingStatusEnum('status').notNull().default('draft'),
    title: varchar('title', { length: 60 }).notNull().default(''),
    description: text('description').notNull().default(''),
    roomType: roomTypeEnum('room_type').notNull().default('entire_place'),
    propertyType: propertyTypeEnum('property_type').notNull().default('condo'),
    sizeSqm: integer('size_sqm'),
    maxGuests: integer('max_guests').notNull().default(2),
    bedrooms: integer('bedrooms').notNull().default(1),
    beds: integer('beds').notNull().default(1),
    bathrooms: numeric('bathrooms', { precision: 3, scale: 1, mode: 'number' }).notNull().default(1),
    floor: integer('floor'),
    // location
    addressLine: text('address_line'),
    subdistrict: varchar('subdistrict', { length: 100 }),
    district: varchar('district', { length: 100 }),
    province: varchar('province', { length: 100 }).notNull().default('Bangkok'),
    postcode: varchar('postcode', { length: 5 }),
    /** Neighbourhood guests see, e.g. "Ari" */
    area: varchar('area', { length: 60 }).notNull().default(''),
    location: point('location'),
    publicLocation: point('public_location'),
    nearestStation: varchar('nearest_station', { length: 80 }),
    stationWalkMinutes: integer('station_walk_minutes'),
    amenities: text('amenities')
      .array()
      .$type<Amenity[]>()
      .notNull()
      .default(sql`'{}'::text[]`),
    // pricing (satang)
    basePrice: integer('base_price').notNull().default(0),
    cleaningFee: integer('cleaning_fee').notNull().default(0),
    weeklyDiscountPct: integer('weekly_discount_pct').notNull().default(0),
    // availability
    instantBook: boolean('instant_book').notNull().default(false),
    minNights: integer('min_nights').notNull().default(1),
    maxNights: integer('max_nights').notNull().default(90),
    advanceNoticeDays: integer('advance_notice_days').notNull().default(0),
    bookingWindowMonths: integer('booking_window_months').notNull().default(12),
    checkInFrom: varchar('check_in_from', { length: 5 }).notNull().default('14:00'),
    checkOutBy: varchar('check_out_by', { length: 5 }).notNull().default('11:00'),
    // policies
    cancellationPolicy: cancellationPolicyEnum('cancellation_policy').notNull().default('moderate'),
    houseRules: jsonb('house_rules')
      .$type<HouseRules>()
      .notNull()
      .default({ smoking: false, pets: false, events: false, notes: null }),
    // reviews (denormalised, phase 2 keeps them current)
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2, mode: 'number' }),
    reviewCount: integer('review_count').notNull().default(0),
    /** Moderator note when changes are requested or the listing is rejected. */
    reviewNote: text('review_note'),
    submittedAt: tstz('submitted_at'),
    publishedAt: tstz('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('listings_host_idx').on(t.hostId),
    index('listings_status_idx').on(t.status),
    index('listings_public_location_gist').using('gist', t.publicLocation),
    check('listings_money_nonneg', sql`${t.basePrice} >= 0 and ${t.cleaningFee} >= 0`),
    check('listings_nights_valid', sql`${t.minNights} >= 1 and ${t.maxNights} >= ${t.minNights}`),
  ],
);

export const listingPhotos = pgTable(
  'listing_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    url: text('url').notNull(),
    caption: varchar('caption', { length: 140 }),
    position: integer('position').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    createdAt: createdAt(),
  },
  (t) => [index('listing_photos_listing_idx').on(t.listingId, t.position)],
);

/** Nights the host blocked in the calendar. One row per night. */
export const listingBlocks = pgTable(
  'listing_blocks',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.date] })],
);

/** Host special prices per night (satang). New bookings only; existing bookings keep their price. */
export const listingPriceOverrides = pgTable(
  'listing_price_overrides',
  {
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    price: integer('price').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.date] }), check('price_override_positive', sql`${t.price} > 0`)],
);

export const savedListings = pgTable(
  'saved_listings',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.listingId] })],
);
