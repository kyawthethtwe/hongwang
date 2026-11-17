import type { AvailabilityDto, ListingDetailDto } from '@hongwang/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

/**
 * Public listing queries. Owner: Listings & Search module.
 * (Host-side listing CRUD hooks live with the editor in src/lib/queries/host.ts.)
 */
export const listingKeys = {
  all: ['listings'] as const,
  detail: (id: string) => ['listings', 'detail', id] as const,
  availability: (id: string, from: string, to: string) => ['listings', 'availability', id, from, to] as const,
};

export function useListing(id: string, initialData?: ListingDetailDto) {
  return useQuery({
    queryKey: listingKeys.detail(id),
    queryFn: ({ signal }) => apiFetch<ListingDetailDto>(`/listings/${id}`, { signal }),
    initialData,
  });
}

/** Unavailable nights and nightly prices for [from, to). */
export function useAvailability(id: string, from: string, to: string) {
  return useQuery({
    queryKey: listingKeys.availability(id, from, to),
    queryFn: ({ signal }) => apiFetch<AvailabilityDto>(`/listings/${id}/availability`, { query: { from, to }, signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
