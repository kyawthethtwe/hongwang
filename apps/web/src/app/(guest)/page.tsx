import { SearchPage, type SearchParamsPromise } from '@/components/search/search-page';

/** Home is the search experience (design A1), same as /search. */
export default function HomePage({ searchParams }: { searchParams: SearchParamsPromise }) {
  return <SearchPage searchParams={searchParams} />;
}
