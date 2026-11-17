import {
  AbilityBuilder,
  createMongoAbility,
  subject as caslSubject,
  type ForcedSubject,
  type MongoAbility,
} from '@casl/ability';
import { Global, Injectable, Module } from '@nestjs/common';
import type { AuthUser } from '../common/auth';
import { forbidden } from '../common/errors';

/**
 * Ownership, not roles (whiteboard "Key decisions"): one account type, CASL checks hostId and
 * guestId, and admin is the only global role. Rows follow the role matrix on the whiteboard.
 *
 * Usage in a service:
 *   const ability = this.abilities.for(user);
 *   assertCan(ability, 'update', 'Listing', listingRow);   // throws 403 FORBIDDEN
 *   if (ability.can('approve', sub('Booking', bookingRow))) ...
 */
export type Action =
  | 'manage'
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'book'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'pay'
  | 'review'
  | 'moderate';

export type SubjectName = 'Listing' | 'Booking' | 'User' | 'Payout';

/** Fields CASL conditions look at, per subject. Rows passed to `sub()` must include them. */
type SubjectFields = {
  Listing: { hostId: string; status: string };
  Booking: { guestId: string; hostId: string; status: string };
  User: { id: string };
  Payout: { hostId: string };
};
type Tagged = { [K in SubjectName]: ForcedSubject<K> & SubjectFields[K] }[SubjectName];

export type AppAbility = MongoAbility<[Action, SubjectName | 'all' | Tagged]>;

/** Tag a plain row with its subject type for CASL: `ability.can('update', sub('Listing', row))`. */
export const sub = <K extends SubjectName>(type: K, row: SubjectFields[K]) =>
  caslSubject(type, { ...row }) as unknown as Tagged;

export function defineAbilityFor(user: AuthUser | undefined): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // Everyone: search and view published listings.
  can('read', 'Listing', { status: 'published' });

  if (user) {
    // Listings: create, and manage your own.
    can('create', 'Listing');
    can(['read', 'update', 'delete'], 'Listing', { hostId: user.id });
    // Request or instant-book: any published listing that isn't yours.
    can('book', 'Listing', { status: 'published' });
    cannot('book', 'Listing', { hostId: user.id });

    // Bookings as guest: read, pay, cancel your own; review after the stay.
    can(['read', 'pay', 'cancel', 'review'], 'Booking', { guestId: user.id });
    // Bookings as host: read, approve, reject, cancel (full refund) on your listings.
    can(['read', 'approve', 'reject', 'cancel', 'review'], 'Booking', { hostId: user.id });

    can(['read', 'update', 'delete'], 'User', { id: user.id });
    can('read', 'Payout', { hostId: user.id });

    if (user.role === 'admin') {
      can('manage', 'all');
    }
  }

  return build();
}

@Injectable()
export class AbilityFactory {
  for(user: AuthUser | undefined): AppAbility {
    return defineAbilityFor(user);
  }
}

/** Throws 403 unless `ability` allows `action` on `row` (or on the subject type when row is omitted). */
export function assertCan<K extends SubjectName>(
  ability: AppAbility,
  action: Action,
  type: K,
  row?: SubjectFields[K],
  message?: string,
) {
  const ok = row ? ability.can(action, sub(type, row)) : ability.can(action, type);
  if (!ok) throw forbidden(message);
}

@Global()
@Module({ providers: [AbilityFactory], exports: [AbilityFactory] })
export class AuthzModule {}
