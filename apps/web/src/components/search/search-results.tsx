'use client';

import type { ListingSummaryDto } from '@hongwang/shared';
import { SearchX } from 'lucide-react';
import { ListingCard, ListingCardSkeleton } from '@/components/listings/listing-card';
import { Button } from '@/components/ui/button';
import { Banner, EmptyState } from '@/components/ui/feedback';

const grid = 'grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-5 gap-y-7';

export function SearchResults({
  listings,
  total,
  nights,
  status,
  dimmed,
  highlightedId,
  onHover,
  listingHref,
  hasMore,
  loadingMore,
  onMore,
  onRetry,
  empty,
}: {
  listings: ListingSummaryDto[];
  total: number;
  nights: number | null;
  status: 'pending' | 'error' | 'success';
  dimmed: boolean;
  highlightedId: string | null;
  onHover: (id: string | null) => void;
  listingHref: (id: string) => string;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onRetry: () => void;
  empty: { body: string; action?: { label: string; onClick: () => void } };
}) {
  if (status === 'pending') {
    return (
      <div className={grid} role="status" aria-label="Loading rooms">
        {Array.from({ length: 6 }, (_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (status === 'error' && listings.length === 0) {
    return (
      <Banner
        tone="danger"
        title="We couldn’t load rooms."
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      >
        Check your connection and try again.
      </Banner>
    );
  }
  if (listings.length === 0) {
    return (
      <EmptyState
        icon={<SearchX aria-hidden className="size-8" />}
        title="No rooms match your search"
        action={
          empty.action && (
            <Button variant="outline-dark" onClick={empty.action.onClick}>
              {empty.action.label}
            </Button>
          )
        }
      >
        {empty.body}
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      <div className={grid} aria-busy={dimmed || undefined} style={{ opacity: dimmed ? 0.55 : 1, transition: 'opacity 150ms' }}>
        {listings.map((l, i) => (
          <ListingCard
            key={l.id}
            listing={l}
            href={listingHref(l.id)}
            nights={nights}
            active={l.id === highlightedId}
            onHoverChange={(h) => onHover(h ? l.id : null)}
            priority={i < 3}
          />
        ))}
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="m-0 text-sm text-muted">
          Showing {listings.length} of {total}
        </p>
        {hasMore && (
          <Button variant="outline-dark" onClick={onMore} loading={loadingMore}>
            Show more
          </Button>
        )}
      </div>
    </div>
  );
}
