'use client';

import type { ListingSummaryDto } from '@hongwang/shared';
import { Star } from 'lucide-react';
import Link from 'next/link';
import { formatTHB, pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ListingImage, tintFor } from './listing-image';
import { SaveHeart } from './save-button';

/** "4 min walk to BTS Ari" */
export function transitLabel(l: Pick<ListingSummaryDto, 'transit'>) {
  return l.transit ? `${l.transit.walkMinutes} min walk to ${l.transit.station}` : null;
}

export function Rating({ rating, className }: { rating: number | null; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm whitespace-nowrap', className)}>
      <Star aria-hidden className="size-3.5 fill-ink text-ink" />
      {rating !== null ? (
        <>
          <span className="sr-only">Rated</span>
          {rating.toFixed(2)}
        </>
      ) : (
        'New'
      )}
    </span>
  );
}

/**
 * Result card (design A1 / B5): photo, Instant book badge, heart, title, rating, area · transit, price.
 * `action` replaces the heart (the saved page uses a remove button); `footer` adds a line below.
 */
export function ListingCard({
  listing,
  href,
  nights,
  active,
  onHoverChange,
  priority,
  action,
  footer,
}: {
  listing: ListingSummaryDto;
  href: string;
  nights?: number | null;
  active?: boolean;
  onHoverChange?: (hovering: boolean) => void;
  priority?: boolean;
  action?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const transit = transitLabel(listing);
  return (
    <article
      className="relative"
      onMouseEnter={onHoverChange ? () => onHoverChange(true) : undefined}
      onMouseLeave={onHoverChange ? () => onHoverChange(false) : undefined}
      onFocus={onHoverChange ? () => onHoverChange(true) : undefined}
      onBlur={onHoverChange ? () => onHoverChange(false) : undefined}
    >
      <Link href={href} className="flex flex-col gap-2 text-ink no-underline hover:text-ink">
        <div
          className={cn(
            'relative aspect-[3/2] overflow-hidden rounded-[14px] ring-offset-2 transition-shadow',
            active && 'ring-2 ring-brand',
          )}
        >
          <ListingImage
            src={listing.coverPhotoUrl}
            alt={listing.title}
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 100vw"
            tint={tintFor(listing.id)}
            priority={priority}
          />
          {listing.instantBook && (
            <span className="absolute top-3 left-3 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink">
              Instant book
            </span>
          )}
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-base leading-[1.35] font-semibold">{listing.title}</h2>
          <Rating rating={listing.rating} />
        </div>
        <p className="m-0 text-sm text-muted">{[listing.area, transit].filter(Boolean).join(' · ')}</p>
        <p className="m-0">
          <strong className="font-semibold">{formatTHB(listing.basePrice)}</strong> night
          {listing.stayTotal !== null && nights ? (
            <span className="text-muted">
              {' '}
              · {formatTHB(listing.stayTotal)} for {pluralize(nights, 'night')}
            </span>
          ) : null}
        </p>
        {footer}
      </Link>
      <div className="absolute top-2.5 right-2.5">{action ?? <SaveHeart id={listing.id} title={listing.title} />}</div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <div className="aspect-[3/2] animate-pulse rounded-[14px] bg-line-soft" />
      <div className="mt-1 h-5 w-3/4 animate-pulse rounded bg-line-soft" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-line-soft" />
      <div className="h-5 w-2/3 animate-pulse rounded bg-line-soft" />
    </div>
  );
}
