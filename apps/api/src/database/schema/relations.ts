import { relations } from 'drizzle-orm';
import { bookingEvents, bookings, payments } from './bookings';
import { listingBlocks, listingPhotos, listingPriceOverrides, listings, savedListings } from './listings';
import { sessions, users } from './users';

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  listings: many(listings),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  host: one(users, { fields: [listings.hostId], references: [users.id] }),
  photos: many(listingPhotos),
  blocks: many(listingBlocks),
  priceOverrides: many(listingPriceOverrides),
  bookings: many(bookings),
}));

export const listingPhotosRelations = relations(listingPhotos, ({ one }) => ({
  listing: one(listings, { fields: [listingPhotos.listingId], references: [listings.id] }),
}));

export const listingBlocksRelations = relations(listingBlocks, ({ one }) => ({
  listing: one(listings, { fields: [listingBlocks.listingId], references: [listings.id] }),
}));

export const listingPriceOverridesRelations = relations(listingPriceOverrides, ({ one }) => ({
  listing: one(listings, { fields: [listingPriceOverrides.listingId], references: [listings.id] }),
}));

export const savedListingsRelations = relations(savedListings, ({ one }) => ({
  user: one(users, { fields: [savedListings.userId], references: [users.id] }),
  listing: one(listings, { fields: [savedListings.listingId], references: [listings.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  listing: one(listings, { fields: [bookings.listingId], references: [listings.id] }),
  guest: one(users, { fields: [bookings.guestId], references: [users.id], relationName: 'guest' }),
  host: one(users, { fields: [bookings.hostId], references: [users.id], relationName: 'host' }),
  payments: many(payments),
  events: many(bookingEvents),
}));

export const bookingEventsRelations = relations(bookingEvents, ({ one }) => ({
  booking: one(bookings, { fields: [bookingEvents.bookingId], references: [bookings.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
}));
