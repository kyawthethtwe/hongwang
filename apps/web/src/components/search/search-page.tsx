import type { SearchResultDto } from '@hongwang/shared';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { serverFetch } from '@/lib/api/server';
import { searchKeys, searchPageQuery } from '@/lib/queries/search';
import { SearchExperience } from './search-experience';
import { loadSearchParams, toApiSearchQuery } from './search-params';

export type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

/**
 * Server half of the search page (/ and /search): parses the URL, fetches the first results page
 * with the visitor's cookies and hands it to the client experience through the query cache.
 */
export async function SearchPage({ searchParams }: { searchParams: SearchParamsPromise }) {
  const state = await loadSearchParams(searchParams);
  const query = toApiSearchQuery(state);
  const qc = new QueryClient();
  await qc.prefetchInfiniteQuery({
    queryKey: searchKeys.results(query),
    queryFn: ({ pageParam }) => serverFetch<SearchResultDto>('/search', { query: searchPageQuery(query, pageParam) }),
    initialPageParam: null as string | null,
  });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <SearchExperience />
    </HydrationBoundary>
  );
}
