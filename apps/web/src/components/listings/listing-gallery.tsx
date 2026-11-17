'use client';

import type { ListingPhotoDto } from '@hongwang/shared';
import { useState } from 'react';
import { Dialog } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';
import { ListingImage, tintFor } from './listing-image';

/**
 * Photo grid (design A2): one large photo and four small ones, tinted placeholders where photos
 * are missing, and a "Show all N photos" dialog.
 */
export function ListingGallery({ listingId, title, photos }: { listingId: string; title: string; photos: ListingPhotoDto[] }) {
  const [open, setOpen] = useState(false);
  const [main, ...rest] = photos;
  const small = Array.from({ length: 4 }, (_, i) => rest[i] ?? null);
  const alt = (p: ListingPhotoDto | null | undefined, i: number) => p?.caption || `${title}, photo ${i + 1}`;

  const tile = (p: ListingPhotoDto | null, i: number, className: string, sizes: string, priority = false) => {
    const body = (
      <ListingImage src={p?.url} alt={alt(p, i)} sizes={sizes} tint={tintFor(listingId, i)} priority={priority} label="Photo coming soon" />
    );
    return p ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open photos: ${alt(p, i)}`}
        className={cn('relative block cursor-zoom-in overflow-hidden border-0 p-0', className)}
      >
        {body}
      </button>
    ) : (
      <div className={cn('relative overflow-hidden', className)}>{body}</div>
    );
  };

  return (
    <section aria-label="Photos" className="relative flex flex-wrap gap-2">
      {tile(main ?? null, 0, 'h-64 flex-[2_1_480px] rounded-panel sm:h-[408px]', '(min-width: 1024px) 760px, 100vw', true)}
      <div className="hidden flex-[1_1_320px] grid-cols-2 gap-2 sm:grid">
        {small.map((p, i) => (
          <div key={p?.id ?? `empty-${i}`}>{tile(p, i + 1, 'h-[200px] w-full rounded-[14px]', '(min-width: 1024px) 220px, 50vw')}</div>
        ))}
      </div>
      {photos.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute right-3 bottom-3 min-h-10 cursor-pointer rounded-field border border-ink bg-surface px-3.5 text-[13px] font-semibold text-ink"
        >
          Show all {photos.length} photo{photos.length === 1 ? '' : 's'}
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen} title={`${title}: all photos`} className="max-w-3xl">
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {photos.map((p, i) => (
            <li key={p.id}>
              <figure className="m-0 flex flex-col gap-1.5">
                <div className="relative aspect-[3/2] overflow-hidden rounded-[14px] bg-line-soft">
                  <ListingImage src={p.url} alt={alt(p, i)} sizes="(min-width: 768px) 720px, 100vw" tint={tintFor(listingId, i)} />
                </div>
                {p.caption && <figcaption className="text-sm text-ink-2">{p.caption}</figcaption>}
              </figure>
            </li>
          ))}
        </ul>
      </Dialog>
    </section>
  );
}
