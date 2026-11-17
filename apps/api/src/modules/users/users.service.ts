import {
  ERROR_CODES,
  todayInBangkok,
  type AvatarUploadInput,
  type ChangePasswordInput,
  type MeDto,
  type PublicUserDto,
  type SessionDto,
  type UpdateProfileInput,
  type UploadTarget,
} from '@hongwang/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import type { AuthUser } from '../../common/auth';
import { AppException, badRequest, notFound } from '../../common/errors';
import { toPublicUser } from '../../common/mappers';
import { ENV, type Env } from '../../config/env';
import { InjectDb, type Database, type DbOrTx } from '../../database/database.module';
import { bookings, listings, users, verificationTokens } from '../../database/schema';
import { StorageService } from '../../infra/storage/storage.service';
import { hashPassword, verifyPassword } from '../auth/passwords';
import { SessionsService } from './sessions.service';
import { toMeDto, toSessionDto, type UserRow } from './users.mappers';

/** Bookings in these states (with check-out today or later) block account deletion. */
export const DELETE_BLOCKING_STATUSES = ['requested', 'payment_hold', 'confirmed'] as const;

/**
 * Accounts: lookup, MeDto, profile, password, sessions, avatar, deletion, public profile.
 * Owner: Auth & Accounts module. Other modules may reuse `getMe`, `toMe`, `isHost`, `findById`.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly sessions: SessionsService,
    private readonly storage: StorageService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ---- lookups ----

  /** Any user row, including deleted and suspended ones. */
  async findById(id: string, db: DbOrTx = this.db): Promise<UserRow | null> {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  /** Non-deleted user by email (citext, so case-insensitive). */
  async findByEmail(email: string, db: DbOrTx = this.db): Promise<UserRow | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findByPhone(phone: string, db: DbOrTx = this.db): Promise<UserRow | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.phone, phone), isNull(users.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findByGoogleId(googleId: string, db: DbOrTx = this.db): Promise<UserRow | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.googleId, googleId), isNull(users.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /** True once the user has created a listing that isn't deleted. */
  async isHost(userId: string, db: DbOrTx = this.db): Promise<boolean> {
    const [row] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.hostId, userId), isNull(listings.deletedAt)))
      .limit(1);
    return !!row;
  }

  async toMe(user: UserRow, db: DbOrTx = this.db): Promise<MeDto> {
    return toMeDto(user, { isHost: await this.isHost(user.id, db) });
  }

  /** The caller's MeDto; 401 when the account is gone or suspended. */
  async getMe(userId: string): Promise<MeDto> {
    const user = await this.findById(userId);
    if (!user || user.deletedAt || user.suspendedAt) {
      throw new AppException(401, ERROR_CODES.unauthorized, 'Please sign in');
    }
    return this.toMe(user);
  }

  private async requireActive(userId: string, db: DbOrTx = this.db): Promise<UserRow> {
    const user = await this.findById(userId, db);
    if (!user || user.deletedAt) throw new AppException(401, ERROR_CODES.unauthorized, 'Please sign in');
    return user;
  }

  // ---- profile ----

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<MeDto> {
    const user = await this.requireActive(userId);
    const patch: Partial<typeof users.$inferInsert> = {};
    if (input.firstName !== undefined) patch.firstName = input.firstName;
    if (input.lastName !== undefined) patch.lastName = input.lastName;
    if (input.about !== undefined) patch.about = input.about || null;
    if (input.locale !== undefined) patch.locale = input.locale;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.timezone !== undefined) patch.timezone = input.timezone;

    let oldAvatarKey: string | null = null;
    if (input.avatarUrl !== undefined && input.avatarUrl !== user.avatarUrl) {
      if (input.avatarUrl !== null) {
        const key = this.avatarKeyFromUrl(userId, input.avatarUrl);
        if (!key) throw badRequest('Upload the photo first', [{ path: ['avatarUrl'], message: 'Upload the photo first' }]);
        if (!(await this.storage.exists(key))) {
          throw badRequest('That photo hasn’t finished uploading', [{ path: ['avatarUrl'], message: 'That photo hasn’t finished uploading' }]);
        }
      }
      patch.avatarUrl = input.avatarUrl;
      oldAvatarKey = user.avatarUrl ? this.avatarKeyFromUrl(userId, user.avatarUrl) : null;
    }

    if (Object.keys(patch).length === 0) return this.toMe(user);
    const [updated] = await this.db.update(users).set(patch).where(eq(users.id, userId)).returning();
    if (oldAvatarKey) {
      await this.storage.delete(oldAvatarKey).catch((err: unknown) => this.logger.warn(`Could not delete old avatar: ${String(err)}`));
    }
    return this.toMe(updated!);
  }

  /** Storage key for an avatar URL we issued for this user (`avatars/<userId>/...`), else null. */
  private avatarKeyFromUrl(userId: string, url: string): string | null {
    const prefixKey = `avatars/${userId}/`;
    const prefixUrl = this.storage.publicUrl(prefixKey);
    if (!url.startsWith(prefixUrl)) return null;
    const rest = url.slice(prefixUrl.length);
    if (!/^[A-Za-z0-9-]+\.[a-z0-9]+$/.test(rest)) return null;
    return prefixKey + rest;
  }

  async createAvatarUploadTarget(userId: string, input: AvatarUploadInput): Promise<UploadTarget> {
    await this.requireActive(userId);
    const key = this.storage.newKey(`avatars/${userId}`, input.contentType);
    return this.storage.createUploadTarget(key, input.contentType, input.size);
  }

  // ---- password ----

  /** Sets a new password (checking the current one when the account has one) and signs out other sessions. */
  async changePassword(caller: AuthUser, input: ChangePasswordInput): Promise<void> {
    const user = await this.requireActive(caller.id);
    if (user.passwordHash) {
      const ok = input.currentPassword ? await verifyPassword(user.passwordHash, input.currentPassword) : false;
      if (!ok) {
        const message = input.currentPassword ? 'That password isn’t right' : 'Enter your current password';
        throw badRequest(message, [{ path: ['currentPassword'], message }]);
      }
    }
    const passwordHash = await hashPassword(input.newPassword);
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, passwordChangedAt: new Date() }).where(eq(users.id, user.id));
      await this.sessions.revokeAll(user.id, { except: caller.sessionId }, tx);
    });
  }

  // ---- sessions ----

  async listSessions(caller: AuthUser): Promise<SessionDto[]> {
    const rows = await this.sessions.listActive(caller.id);
    const dtos = rows.map((r) => toSessionDto(r, caller.sessionId));
    // This device first, then most recent.
    return dtos.sort((a, b) => Number(b.current) - Number(a.current));
  }

  /** Returns whether the revoked session was the caller's own. */
  async revokeSession(caller: AuthUser, sessionId: string): Promise<{ current: boolean }> {
    const revoked = await this.sessions.revoke(caller.id, sessionId);
    if (!revoked) throw notFound('Session');
    return { current: sessionId === caller.sessionId };
  }

  async revokeOtherSessions(caller: AuthUser): Promise<void> {
    await this.sessions.revokeAll(caller.id, { except: caller.sessionId });
  }

  // ---- deletion ----

  /** How many bookings (as guest or host) still block deletion. */
  async countBlockingBookings(userId: string, db: DbOrTx = this.db): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(
        and(
          or(eq(bookings.guestId, userId), eq(bookings.hostId, userId)),
          inArray(bookings.status, [...DELETE_BLOCKING_STATUSES]),
          gte(bookings.checkOut, todayInBangkok()),
        ),
      );
    return row?.n ?? 0;
  }

  /**
   * Soft delete. Frees the email, phone and Google id for reuse, removes the profile details,
   * takes the user's listings off the site and signs out every session. Booking rows (receipts)
   * keep pointing at the user row.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.requireActive(userId);
    const avatarKey = user.avatarUrl ? this.avatarKeyFromUrl(userId, user.avatarUrl) : null;

    await this.db.transaction(async (tx) => {
      // Lock the row so a booking can't sneak in between the check and the delete.
      await tx.execute(sql`select id from ${users} where ${users.id} = ${userId} for update`);
      const blocking = await this.countBlockingBookings(userId, tx);
      if (blocking > 0) {
        const stays = `${blocking} upcoming ${blocking === 1 ? 'stay' : 'stays'}`;
        throw new AppException(
          409,
          ERROR_CODES.conflict,
          `You can’t delete your account while you have ${stays} or open requests. Cancel or finish them first.`,
          { upcomingBookings: blocking },
        );
      }
      const now = new Date();
      await tx
        .update(users)
        .set({
          // users_email_or_phone requires one of them: keep an undeliverable tombstone address.
          email: `deleted+${userId}@hongwang.invalid`,
          phone: null,
          googleId: null,
          passwordHash: null,
          emailVerifiedAt: null,
          phoneVerifiedAt: null,
          avatarUrl: null,
          about: null,
          lineOptIn: false,
          deletedAt: now,
        })
        .where(eq(users.id, userId));
      await tx
        .update(listings)
        .set({ status: 'paused', deletedAt: now })
        .where(and(eq(listings.hostId, userId), isNull(listings.deletedAt)));
      await tx.delete(verificationTokens).where(eq(verificationTokens.userId, userId));
      await this.sessions.revokeAll(userId, {}, tx);
    });

    if (avatarKey) await this.storage.delete(avatarKey).catch(() => undefined);
  }

  // ---- public ----

  async getPublicProfile(id: string): Promise<PublicUserDto> {
    const user = await this.findById(id);
    if (!user || user.deletedAt) throw notFound('User');
    return toPublicUser(user);
  }
}
