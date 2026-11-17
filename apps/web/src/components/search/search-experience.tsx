'use client';

import type { ListingSummaryDto } from '@hongwang/shared';
import { List, MapIcon } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useMemo, useState } from 'react';
import { SearchMap } from '@/components/map';
import { formatStay, pluralize } from '@/lib/format';
import { useSearchResults } from '@/lib/queries/search';
import { cn } from '@/lib/utils';
import { SearchBar } from './search-bar';
import { CLEARED_FILTERS, hasFilters, searchParsers, serializeSearch, stayOf, toApiSearchQuery } from './search-params';
import { SearchResults } from './search-results';
import { SearchToolbar } from './search-toolbar';

/**
 * The search experience on / and /search (design A1). All state lives in the URL (nuqs); the
 * first page is SSR-prefetched into the same TanStack Query key by the server page.
 */
export function SearchExperience() {
  const [state, setState] = useQueryStates(searchParsers, { history: 'push', scroll: false });
  const apiQuery = useMemo(() => toApiSearchQuery(state), [state]);
  const results = useSearchResults(apiQuery);
  const pages = results.data?.pages;
  const first = pages?.[0];
  const listings = useMemo(() => uniqueById(pages?.flatMap((p) => p.items) ?? []), [pages]);
  const total = first?.total ?? 0;
  const place = first?.place ?? null;
  const stay = stayOf(state);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moveSearch, setMoveSearch] = useState(true);
  const [showMap, setShowMap] = useState(false);

  // Re-fit the map only once results for a new place (or a cleared map box) have arrived.
  const [focusKey, setFocusKey] = useState('');
  const settledKey = `${place?.slug ?? 'all'}|${state.bbox ? 'box' : 'fit'}`;
  if (first && !results.isPlaceholderData && settledKey !== focusKey) setFocusKey(settledKey);

  const linkQuery = serializeSearch(state);
  const listingHref = (id: string) => `/rooms/${id}${linkQuery}`;

  const areaName = place && place.slug !== 'bangkok' ? place.name : null;
  const heading = state.bbox ? (areaName ? `Rooms near ${areaName}` : 'Rooms in this area') : `Rooms in ${areaName ?? 'Bangkok'}`;
  const summary = [
    results.isPending ? 'Searching…' : pluralize(total, 'stay'),
    stay ? formatStay(stay.checkIn, stay.checkOut) : null,
    state.guests && state.guests > 0 ? pluralize(state.guests, 'guest') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const empty = state.bbox
    ? {
        body: 'Try zooming out or moving the map.',
        action: { label: `Search all of ${areaName ?? 'Bangkok'}`, onClick: () => void setState({ bbox: null }) },
      }
    : hasFilters(state)
      ? { body: 'Try removing a filter.', action: { label: 'Clear filters', onClick: () => void setState(CLEARED_FILTERS) } }
      : stay
        ? {
            body: 'Nothing here is free for those dates. Try other dates.',
            action: { label: 'Clear dates', onClick: () => void setState({ checkIn: null, checkOut: null }) },
          }
        : { body: 'No rooms are listed here yet. Try a nearby neighbourhood.' };

  return (
    <div className="flex flex-col">
      <section aria-label="Search" className="px-4 pt-5 sm:px-10">
        <SearchBar
          value={{ place: state.place, checkIn: state.checkIn, checkOut: state.checkOut, guests: state.guests }}
          placeLabel={place?.label ?? null}
          onSearch={(v) => {
            setSelectedId(null);
            void setState({ ...v, bbox: null });
          }}
        />
      </section>

      <SearchToolbar heading={heading} summary={summary} state={state} onChange={(patch) => void setState(patch)} />

      <main className="grid grid-cols-1 items-start gap-6 px-4 pt-4 pb-24 sm:px-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-10 xl:grid-cols-[minmax(0,1fr)_480px]">
        <section aria-label="Results" className={cn('min-w-0', showMap && 'max-lg:hidden')}>
          <SearchResults
            listings={listings}
            total={total}
            nights={stay?.nights ?? null}
            status={results.status}
            dimmed={results.isPlaceholderData}
            highlightedId={hoveredId ?? selectedId}
            onHover={setHoveredId}
            listingHref={listingHref}
            hasMore={!!results.hasNextPage}
            loadingMore={results.isFetchingNextPage}
            onMore={() => void results.fetchNextPage()}
            onRetry={() => void results.refetch()}
            empty={empty}
          />
        </section>

        <aside
          aria-label="Map of results"
          className={cn(
            'relative h-[680px] min-w-0 overflow-hidden rounded-panel border border-line-card bg-map lg:sticky lg:top-4 lg:h-[calc(100dvh-32px)] lg:max-h-[760px]',
            showMap ? 'max-lg:h-[calc(100dvh-160px)]' : 'max-lg:hidden',
          )}
        >
          <SearchMap
            listings={listings}
            highlightedId={hoveredId}
            selectedId={selectedId}
            onSelect={setSelectedId}
            bbox={state.bbox}
            fitBbox={place?.bbox ?? null}
            focusKey={focusKey}
            moveSearch={moveSearch}
            onMoveSearchChange={setMoveSearch}
            onSearchArea={(bbox) => void setState({ bbox }, { history: 'replace' })}
            listingHref={listingHref}
          />
        </aside>
      </main>

      <button
        type="button"
        aria-pressed={showMap}
        onClick={() => setShowMap((s) => !s)}
        className="fixed bottom-6 left-1/2 z-40 inline-flex min-h-12 -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border-0 bg-ink px-5 font-semibold text-white shadow-float lg:hidden"
      >
        {showMap ? <List aria-hidden className="size-[18px]" /> : <MapIcon aria-hidden className="size-[18px]" />}
        {showMap ? 'Show list' : 'Show map'}
      </button>
    </div>
  );
}

function uniqueById(items: ListingSummaryDto[]) {
  const seen = new Set<string>();
  return items.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
}
