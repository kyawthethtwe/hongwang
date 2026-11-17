import type { AuthUser } from '../../src/common/auth';
import type { Database } from '../../src/database/database.module';
import { listings, users } from '../../src/database/schema';

export async function createUsers(db: Database, prefix: string, count: number): Promise<AuthUser[]> {
  const rows = await db
    .insert(users)
    .values(
      Array.from({ length: count }, (_, i) => ({
        firstName: `${prefix[0]!.toUpperCase()}${prefix.slice(1)}`,
        lastName: `No${i + 1}`,
        email: `${prefix}-${i + 1}@e2e.test`,
      })),
    )
    .returning({ id: users.id });
  return rows.map((r) => ({ id: r.id, role: 'user' as const, sessionId: 'e2e' }));
}

export async function createUser(db: Database, prefix: string): Promise<AuthUser> {
  const [u] = await createUsers(db, prefix, 1);
  return u!;
}

export async function createListing(db: Database, hostId: string, over: Partial<typeof listings.$inferInsert> = {}) {
  const [row] = await db
    .insert(listings)
    .values({
      hostId,
      status: 'published',
      title: 'Sunny studio near BTS Ari',
      area: 'Ari',
      addressLine: '[FULL ADDRESS]',
      // Real points, so booking reads (relational queries return GeoJSON) exercise parsePoint.
      location: { x: 100.5452, y: 13.7801 },
      publicLocation: { x: 100.5434, y: 13.7816 },
      basePrice: 120000,
      cleaningFee: 30000,
      instantBook: true,
      maxGuests: 2,
      minNights: 1,
      maxNights: 90,
      advanceNoticeDays: 0,
      bookingWindowMonths: 12,
      cancellationPolicy: 'moderate',
      publishedAt: new Date(),
      ...over,
    })
    .returning();
  return row!;
}
