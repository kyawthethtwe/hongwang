import type { KycStatus, MeDto, SessionDto, UserRole } from '@hongwang/shared';
import { iso } from '../../common/mappers';
import type { sessions, users } from '../../database/schema';
import { describeDevice } from './device';

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;

/**
 * The signed-in user as the web app sees them. `isHost` comes from the listings table
 * (UsersService.isHost). Never exposes hashes or provider ids.
 */
export function toMeDto(u: UserRow, opts: { isHost: boolean }): MeDto {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    emailVerified: !!u.email && !!u.emailVerifiedAt,
    phoneVerified: !!u.phone && !!u.phoneVerifiedAt,
    avatarUrl: u.avatarUrl,
    about: u.about,
    role: u.role as UserRole,
    kycStatus: u.kycStatus as KycStatus,
    isHost: opts.isHost,
    locale: u.locale,
    currency: u.currency,
    timezone: u.timezone,
    hasPassword: !!u.passwordHash,
    passwordChangedAt: u.passwordHash ? iso(u.passwordChangedAt) : null,
    googleConnected: !!u.googleId,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toSessionDto(
  s: Pick<SessionRow, 'id' | 'userAgent' | 'ip' | 'lastUsedAt' | 'createdAt'>,
  currentSessionId: string | undefined,
): SessionDto {
  return {
    id: s.id,
    device: describeDevice(s.userAgent),
    ip: s.ip,
    lastUsedAt: s.lastUsedAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    current: s.id === currentSessionId,
  };
}

