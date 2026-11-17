import type { Metadata } from 'next';
import { SearchPage, type SearchParamsPromise } from '@/components/search/search-page';

export const metadata: Metadata = { title: 'Search rooms' };

export default function SearchRoute({ searchParams }: { searchParams: SearchParamsPromise }) {
  return <SearchPage searchParams={searchParams} />;
}
