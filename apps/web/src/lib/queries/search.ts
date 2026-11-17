import type { PlaceDto, SearchResultDto } from '@hongwang/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import type { ApiSearchQuery } from '@/components/search/search-params';

/**
 * Search queries. Owner: Listings & Search module. No 'use client' here: the server pages import
 * `searchKeys` to prefetch the first page into the same cache entry the client reads.
 */
export const searchKeys = {
  all: ['search'] as const,
  results: (q: ApiSearchQuery) => ['search', 'results', q] as const,
  places: (q: string) => ['search', 'places', q.trim().toLowerCase()] as const,
};

export const SEARCH_PAGE_SIZE = 24;

export const searchPageQuery = (q: ApiSearchQuery, cursor: string | null) => ({
  ...q,
  limit: SEARCH_PAGE_SIZE,
  cursor: cursor ?? undefined,
});

export function useSearchResults(q: ApiSearchQuery) {
  return useInfiniteQuery({
    queryKey: searchKeys.results(q),
    queryFn: ({ pageParam, signal }) =>
      apiFetch<SearchResultDto>('/search', { query: searchPageQuery(q, pageParam), signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** "Where" autocomplete. The list is static, so it is cached for the session. */
export function usePlaces(q: string) {
  return useQuery({
    queryKey: searchKeys.places(q),
    queryFn: ({ signal }) => apiFetch<PlaceDto[]>('/search/places', { query: { q: q.trim() }, signal }),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
}
