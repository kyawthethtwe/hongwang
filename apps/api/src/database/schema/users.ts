import type { HOST_RELATIONS, HOST_ROOM_COUNTS } from '@hongwang/shared';
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, pgTable, primaryKey, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { emailStatusEnum, kycStatusEnum, userRoleEnum, verificationKindEnum } from './enums';
import { citext, createdAt, tstz, updatedAt } from './types';

export interface HostProfile {
  relation?: (typeof HOST_RELATIONS)[number];
  roomCount?: (typeof HOST_ROOM_COUNTS)[number];
  onboardedAt?: string;
}

/**
 * One account type (whiteboard "Ownership, not roles"): anyone can be a guest and a host.
 * `role` is only 'user' or 'admin'. Hosting rights come from owning a listing.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: citext('email').unique(),
    passwordHash: text('password_hash'),
    firstName: varchar('first_name', { length: 60 }).notNull(),
    lastName: varchar('last_name', { length: 60 }).notNull().default(''),
    phone: varchar('phone', { length: 20 }).unique(),
    emailVerifiedAt: tstz('email_verified_at'),
    phoneVerifiedAt: tstz('phone_verified_at'),
    googleId: text('google_id').unique(),
    avatarUrl: text('avatar_url'),
    about: text('about'),
    role: userRoleEnum('role').notNull().default('user'),
    kycStatus: kycStatusEnum('kyc_status').notNull().default('none'),
    hostProfile: jsonb('host_profile').$type<HostProfile>(),
    /** Stripe Connect account for payouts (phase 2). */
    stripeAccountId: text('stripe_account_id'),
    stripeCustomerId: text('stripe_customer_id'),
    lineOptIn: boolean('line_opt_in').notNull().default(false),
    locale: varchar('locale', { length: 5 }).notNull().default('en'),
    currency: varchar('currency', { length: 3 }).notNull().default('THB'),
    timezone: varchar('timezone', { length: 40 }).notNull().default('Asia/Bangkok'),
    passwordChangedAt: tstz('password_changed_at'),
    suspendedAt: tstz('suspended_at'),
    deletedAt: tstz('deleted_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check('users_email_or_phone', sql`${t.email} is not null or ${t.phone} is not null`)],
);

/** Refresh-token sessions ("Where you're signed in"). The refresh token is stored hashed. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    ip: varchar('ip', { length: 64 }),
    createdAt: createdAt(),
    lastUsedAt: tstz('last_used_at').notNull().defaultNow(),
    expiresAt: tstz('expires_at').notNull(),
    revokedAt: tstz('revoked_at'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** Email verification links, password reset links and phone OTP codes. Token/code stored hashed. */
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    kind: verificationKindEnum('kind').notNull(),
    /** email address or E.164 phone the token was sent to */
    target: varchar('target', { length: 254 }).notNull(),
    tokenHash: text('token_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: tstz('expires_at').notNull(),
    consumedAt: tstz('consumed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('verification_tokens_lookup_idx').on(t.kind, t.target)],
);

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    event: varchar('event', { length: 40 }).notNull(),
    channel: varchar('channel', { length: 10 }).notNull(),
    enabled: boolean('enabled').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.event, t.channel] })],
);

export const emailLog = pgTable(
  'email_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    to: varchar('to', { length: 254 }).notNull(),
    template: varchar('template', { length: 60 }).notNull(),
    status: emailStatusEnum('status').notNull().default('queued'),
    error: text('error'),
    providerMessageId: text('provider_message_id'),
    jobId: text('job_id'),
    createdAt: createdAt(),
    sentAt: tstz('sent_at'),
  },
  (t) => [index('email_log_user_idx').on(t.userId)],
);
