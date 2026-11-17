import type { PublicUserDto } from '@hongwang/shared';
import type { users } from '../database/schema';

type UserRow = typeof users.$inferSelect;

/** What anyone may see about a user. Never includes email or phone. */
export function toPublicUser(u: Pick<UserRow, 'id' | 'firstName' | 'lastName' | 'avatarUrl' | 'about' | 'kycStatus' | 'createdAt'>): PublicUserDto {
  const lastInitial = u.lastName ? `${u.lastName[0]!.toUpperCase()}.` : '';
  return {
    id: u.id,
    firstName: u.firstName,
    displayName: [u.firstName, lastInitial].filter(Boolean).join(' '),
    initials: `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase(),
    avatarUrl: u.avatarUrl,
    about: u.about,
    identityVerified: u.kycStatus === 'verified',
    joinedAt: u.createdAt.toISOString(),
  };
}

/** Postgres geometry {x,y} -> {lat,lng}. */
export const toLatLng = (p: { x: number; y: number } | null | undefined) => (p ? { lat: p.y, lng: p.x } : null);

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
