'use client';

import type { HostListingSummaryDto, ListingStatus } from '@hongwang/shared';
import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api/client';
import { formatShortDay, formatTHB, pluralize } from '@/lib/format';
import { useListingStatusAction, useMyListings } from '@/lib/queries/host';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { Chip, PageTitle, PhotoPlaceholder } from '@/components/ui/surfaces';
import { CreateListingButton } from './create-listing-button';
import { PageSkeleton, QueryError } from './query-state';
import { ListingStatusBadge } from './status-badge';

const FILTERS: { id: string; label: string; match: (s: ListingStatus) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'live', label: 'Published', match: (s) => s === 'published' || s === 'paused' },
  { id: 'review', label: 'In review', match: (s) => s === 'in_review' },
  { id: 'draft', label: 'Drafts', match: (s) => s === 'draft' || s === 'rejected' },
];

function note(l: HostListingSummaryDto) {
  if (l.reviewNote) return l.reviewNote;
  switch (l.status) {
    case 'in_review':
      return `Submitted ${formatShortDay(l.updatedAt.slice(0, 10))}. Usually reviewed within 1 business day.`;
    case 'draft':
      return 'Not listed yet. Finish the sections and submit it for review.';
    case 'paused':
      return 'Paused: guests can’t find or book it until you unpause.';
    case 'rejected':
      return 'Our team asked for changes before it can go live.';
    default:
      return l.upcomingBookings ? `${pluralize(l.upcomingBookings, 'upcoming booking')}` : 'No upcoming bookings yet';
  }
}

function meta(l: HostListingSummaryDto) {
  const parts = [l.area || 'Area not set', l.basePrice ? `${formatTHB(l.basePrice)} a night` : 'No price yet'];
  parts.push(l.instantBook ? 'Instant book' : 'Request to book');
  if (l.reviewCount && l.rating) parts.push(`★ ${l.rating.toFixed(2)} (${l.reviewCount})`);
  return parts.join(' · ');
}

const TINTS = [1, 2, 3, 5, 4, 6] as const;

/** Host listings (design C3). */
export function ListingsView() {
  const { data, error, isLoading, refetch } = useMyListings();
  const [filter, setFilter] = useState('all');
  const status = useListingStatusAction();

  async function togglePause(l: HostListingSummaryDto) {
    const action = l.status === 'paused' ? 'unpause' : 'pause';
    try {
      await status.mutateAsync({ id: l.id, action });
      toast.success(action === 'pause' ? `${l.title} is paused.` : `${l.title} is bookable again.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle>Listings</PageTitle>
        <CreateListingButton />
      </div>

      {isLoading ? (
        <PageSkeleton rows={3} />
      ) : error || !data ? (
        <QueryError error={error} retry={() => void refetch()} what="your listings" />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Building2 aria-hidden className="size-8" />}
          title="No listings yet"
          action={<CreateListingButton>Create your first listing</CreateListingButton>}
        >
          Start a draft. You can save each section and come back to it later.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <Chip key={f.id} pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label} · {data.filter((l) => f.match(l.status)).length}
              </Chip>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {data
              .filter((l) => FILTERS.find((f) => f.id === filter)!.match(l.status))
              .map((l, i) => {
                const live = l.status === 'published' || l.status === 'paused';
                return (
                  <article
                    key={l.id}
                    className="flex flex-wrap items-center gap-5 rounded-panel border border-line bg-surface p-4"
                  >
                    {l.coverPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.coverPhotoUrl} alt="" className="h-[100px] w-[140px] flex-none rounded-button object-cover" />
                    ) : (
                      <PhotoPlaceholder tint={TINTS[i % TINTS.length]} label="No photo" className="h-[100px] w-[140px] flex-none rounded-button" />
                    )}
                    <div className="flex min-w-0 flex-[999_1_300px] flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="m-0 text-[17px] font-semibold">{l.title || 'Untitled listing'}</h2>
                        <ListingStatusBadge status={l.status} />
                      </div>
                      <p className="m-0 text-ink-2">{meta(l)}</p>
                      <p className="m-0 text-sm text-muted">{note(l)}</p>
                    </div>
                    <div className="flex flex-[1_1_260px] flex-wrap justify-end gap-2">
                      <Button asChild variant="outline-dark">
                        <Link href={`/host/listings/${l.id}/edit`}>{l.status === 'draft' ? 'Continue' : 'Edit'}</Link>
                      </Button>
                      <Button asChild variant="outline" className="font-medium">
                        <Link href={`/host/calendar?listingId=${l.id}`}>Calendar</Link>
                      </Button>
                      {live && (
                        <Button
                          variant="outline"
                          className="font-medium"
                          loading={status.isPending && status.variables?.id === l.id}
                          onClick={() => void togglePause(l)}
                        >
                          {l.status === 'paused' ? 'Unpause' : 'Pause'}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>
        </>
      )}
      <p className="m-0 text-sm text-muted">
        New and edited listings are checked by our team before they go live, usually within 1 business day. Price and
        calendar changes go live straight away.
      </p>
    </div>
  );
}
