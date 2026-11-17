import {
  MAX_LISTING_PHOTOS,
  type AttachPhotoInput,
  type ListingPhotoDto,
  type PhotoUploadInput,
  type ReorderPhotosInput,
  type UpdatePhotoInput,
  type UploadTarget,
} from '@hongwang/shared';
import { Injectable, Logger } from '@nestjs/common';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import type { AuthUser } from '../../common/auth';
import { badRequest, conflict, notFound } from '../../common/errors';
import { InjectDb, type Database } from '../../database/database.module';
import { listingPhotos, listings } from '../../database/schema';
import { StorageService } from '../../infra/storage/storage.service';
import { toPhotoDto } from './listing.mappers';
import { isListingPhotoKey, isSamePhotoSet, photoPrefix } from './photo-keys';
import { ListingsService } from './listings.service';

/**
 * Owner: Listings & Search module. Listing photos via presigned uploads: the browser PUTs the file
 * to storage, then attaches the key. Position 0 is the cover photo.
 */
@Injectable()
export class ListingPhotosService {
  private readonly logger = new Logger(ListingPhotosService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly listingsService: ListingsService,
    private readonly storage: StorageService,
  ) {}

  async createUploadTarget(listingId: string, user: AuthUser, input: PhotoUploadInput): Promise<UploadTarget> {
    await this.listingsService.loadEditable(listingId, user);
    await this.assertRoom(listingId);
    const key = this.storage.newKey(photoPrefix(listingId), input.contentType);
    return this.storage.createUploadTarget(key, input.contentType, input.size);
  }

  async attach(listingId: string, user: AuthUser, input: AttachPhotoInput): Promise<ListingPhotoDto> {
    await this.listingsService.loadEditable(listingId, user);
    if (!isListingPhotoKey(listingId, input.key)) {
      throw badRequest('That upload doesn’t belong to this listing', [{ path: ['key'], message: 'Unknown upload' }]);
    }
    if (!(await this.storage.exists(input.key))) {
      throw badRequest('We couldn’t find that upload. Try uploading the photo again.', [{ path: ['key'], message: 'Not uploaded' }]);
    }
    const row = await this.db.transaction(async (tx) => {
      // Serialise concurrent attaches for this listing so positions stay unique.
      await tx.execute(sql`SELECT 1 FROM ${listings} WHERE ${listings.id} = ${listingId} FOR UPDATE`);
      const [stats] = await tx
        .select({
          count: sql<number>`count(*)::int`,
          maxPos: sql<number>`coalesce(max(${listingPhotos.position}), -1)::int`,
          dup: sql<number>`(count(*) FILTER (WHERE ${listingPhotos.storageKey} = ${input.key}))::int`,
        })
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, listingId));
      if (Number(stats?.dup ?? 0) > 0) throw conflict('That photo is already attached');
      if (Number(stats?.count ?? 0) >= MAX_LISTING_PHOTOS) throw conflict(`A listing can have up to ${MAX_LISTING_PHOTOS} photos`);
      const [inserted] = await tx
        .insert(listingPhotos)
        .values({
          listingId,
          storageKey: input.key,
          url: this.storage.publicUrl(input.key),
          caption: input.caption ?? null,
          width: input.width ?? null,
          height: input.height ?? null,
          position: Number(stats?.maxPos ?? -1) + 1,
        })
        .returning();
      return inserted!;
    });
    return toPhotoDto(row);
  }

  async updateCaption(listingId: string, photoId: string, user: AuthUser, input: UpdatePhotoInput): Promise<ListingPhotoDto> {
    await this.listingsService.loadEditable(listingId, user);
    const [row] = await this.db
      .update(listingPhotos)
      .set({ caption: input.caption })
      .where(and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, listingId)))
      .returning();
    if (!row) throw notFound('Photo');
    return toPhotoDto(row);
  }

  /** Positions follow the array order; the array must hold exactly the listing's photo ids. */
  async reorder(listingId: string, user: AuthUser, input: ReorderPhotosInput): Promise<ListingPhotoDto[]> {
    await this.listingsService.loadEditable(listingId, user);
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT 1 FROM ${listings} WHERE ${listings.id} = ${listingId} FOR UPDATE`);
      const current = await tx.select({ id: listingPhotos.id }).from(listingPhotos).where(eq(listingPhotos.listingId, listingId));
      if (!isSamePhotoSet(current.map((p) => p.id), input.photoIds)) {
        throw badRequest('Send every photo of this listing exactly once', [{ path: ['photoIds'], message: 'Photo list is out of date' }]);
      }
      for (const [position, id] of input.photoIds.entries()) {
        await tx.update(listingPhotos).set({ position }).where(and(eq(listingPhotos.id, id), eq(listingPhotos.listingId, listingId)));
      }
      const rows = await tx
        .select()
        .from(listingPhotos)
        .where(eq(listingPhotos.listingId, listingId))
        .orderBy(asc(listingPhotos.position));
      return rows.map(toPhotoDto);
    });
  }

  async remove(listingId: string, photoId: string, user: AuthUser): Promise<void> {
    await this.listingsService.loadEditable(listingId, user);
    const deleted = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .delete(listingPhotos)
        .where(and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, listingId)))
        .returning();
      if (!row) throw notFound('Photo');
      // Close the gap so the next photo becomes the cover when the cover is removed.
      await tx
        .update(listingPhotos)
        .set({ position: sql`${listingPhotos.position} - 1` })
        .where(and(eq(listingPhotos.listingId, listingId), gt(listingPhotos.position, row.position)));
      return row;
    });
    await this.storage.delete(deleted.storageKey).catch((err: Error) => {
      this.logger.warn(`Could not delete ${deleted.storageKey} from storage: ${err.message}`);
    });
  }

  private async assertRoom(listingId: string) {
    const [stats] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, listingId));
    if (Number(stats?.count ?? 0) >= MAX_LISTING_PHOTOS) throw conflict(`A listing can have up to ${MAX_LISTING_PHOTOS} photos`);
  }
}
