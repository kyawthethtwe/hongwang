import { todayInBangkok, type SavedListingDto, type SavedQuery } from '@hongwang/shared';
import { Injectable } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { AbilityFactory, sub } from '../../authz/ability';
import type { AuthUser } from '../../common/auth';
import { notFound } from '../../common/errors';
import { InjectDb, type Database } from '../../database/database.module';
import { listings, savedListings } from '../../database/schema';
import { resolveStay } from '../search/search-sql';
import { loadStayTotals } from '../search/stay-totals';
import { buildSavedQuery, savedRowToDto, type SavedRow } from './saved-sql';

/** Owner: Listings & Search module. Saved rooms (design B5). */
@Injectable()
export class SavedService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly abilities: AbilityFactory,
  ) {}

  async list(user: AuthUser, q: SavedQuery, now = new Date()): Promise<SavedListingDto[]> {
    const stay = resolveStay(q.checkIn, q.checkOut);
    const { rows } = await this.db.execute<SavedRow>(buildSavedQuery(user.id, stay, todayInBangkok(now)));
    const totals = await loadStayTotals(this.db, rows, stay);
    return rows.map((r) => savedRowToDto(r, stay ? (totals.get(r.id) ?? null) : null));
  }

  async ids(user: AuthUser): Promise<string[]> {
    const rows = await this.db
      .select({ id: savedListings.listingId })
      .from(savedListings)
      .where(eq(savedListings.userId, user.id))
      .orderBy(desc(savedListings.createdAt));
    return rows.map((r) => r.id);
  }

  /** Idempotent. Only listings the caller may see can be saved. */
  async save(user: AuthUser, listingId: string): Promise<void> {
    const [row] = await this.db
      .select({ hostId: listings.hostId, status: listings.status })
      .from(listings)
      .where(and(eq(listings.id, listingId), isNull(listings.deletedAt)))
      .limit(1);
    if (!row || !this.abilities.for(user).can('read', sub('Listing', row))) throw notFound('Listing');
    await this.db.insert(savedListings).values({ userId: user.id, listingId }).onConflictDoNothing();
  }

  /** Idempotent. */
  async unsave(user: AuthUser, listingId: string): Promise<void> {
    await this.db
      .delete(savedListings)
      .where(and(eq(savedListings.userId, user.id), eq(savedListings.listingId, listingId)));
  }
}
