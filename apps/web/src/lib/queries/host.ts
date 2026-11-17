'use client';

import type {
  AttachPhotoInput,
  BookingDto,
  CancelBookingInput,
  HostCalendarDto,
  HostDashboardDto,
  HostIdentityInput,
  HostListingDto,
  HostListingSummaryDto,
  HostOnboardingDto,
  HostOnboardingInput,
  HostReservationsQuery,
  ListingPhotoDto,
  RefundQuote,
  RejectBookingInput,
  SetBlocksInput,
  SetPricesInput,
  UpdateListingInput,
  UploadTarget,
} from '@hongwang/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

/**
 * Owner: Host Dashboard module. Query keys and hooks for the host pages. Listing CRUD and the
 * booking transitions are other modules' endpoints; the host pages call them through these hooks.
 */
export const hostKeys = {
  all: ['host'] as const,
  dashboard: () => [...hostKeys.all, 'dashboard'] as const,
  reservations: (q: Partial<HostReservationsQuery> = {}) => [...hostKeys.all, 'reservations', q] as const,
  reservation: (id: string) => [...hostKeys.all, 'reservation', id] as const,
  cancellationQuote: (id: string) => [...hostKeys.all, 'reservation', id, 'cancellation-quote'] as const,
  calendar: (listingId: string, month: string) => [...hostKeys.all, 'calendar', listingId, month] as const,
  calendars: (listingId: string) => [...hostKeys.all, 'calendar', listingId] as const,
  onboarding: () => [...hostKeys.all, 'onboarding'] as const,
  listings: () => [...hostKeys.all, 'listings'] as const,
  listing: (id: string) => [...hostKeys.all, 'listing', id] as const,
};

/** Anything that changes bookings or calendars: refresh every host view. */
const invalidateHost = (qc: QueryClient) => qc.invalidateQueries({ queryKey: hostKeys.all });

// ---------------------------------------------------------------- dashboard, reservations

export function useHostDashboard(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: hostKeys.dashboard(),
    queryFn: () => apiFetch<HostDashboardDto>('/host/dashboard'),
    enabled: opts.enabled ?? true,
    refetchInterval: 60_000,
  });
}

export function useHostReservations(q: Partial<HostReservationsQuery> = {}) {
  return useQuery({
    queryKey: hostKeys.reservations(q),
    queryFn: () => apiFetch<BookingDto[]>('/host/reservations', { query: q }),
  });
}

export function useHostReservation(id: string) {
  return useQuery({
    queryKey: hostKeys.reservation(id),
    queryFn: () => apiFetch<BookingDto>(`/bookings/${id}`),
  });
}

export function useCancellationQuote(id: string, enabled: boolean) {
  return useQuery({
    queryKey: hostKeys.cancellationQuote(id),
    queryFn: () => apiFetch<RefundQuote>(`/bookings/${id}/cancellation-quote`),
    enabled,
    staleTime: 0,
  });
}

function useBookingAction<TVars>(path: (vars: TVars) => string, body?: (vars: TVars) => unknown) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: TVars) => apiFetch<BookingDto>(path(vars), { method: 'POST', body: body?.(vars) }),
    onSuccess: (dto) => {
      qc.setQueryData(hostKeys.reservation(dto.id), dto);
      void invalidateHost(qc);
    },
  });
}

export const useApproveBooking = () => useBookingAction<{ id: string }>(({ id }) => `/bookings/${id}/approve`);

export const useRejectBooking = () =>
  useBookingAction<{ id: string } & RejectBookingInput>(
    ({ id }) => `/bookings/${id}/reject`,
    ({ reason }) => ({ reason: reason || undefined }),
  );

export const useCancelBooking = () =>
  useBookingAction<{ id: string } & CancelBookingInput>(
    ({ id }) => `/bookings/${id}/cancel`,
    ({ reason }) => ({ reason }),
  );

// ---------------------------------------------------------------- calendar

export function useHostCalendar(listingId: string | null, month: string) {
  return useQuery({
    queryKey: hostKeys.calendar(listingId ?? '', month),
    queryFn: () => apiFetch<HostCalendarDto>('/host/calendar', { query: { listingId, month } }),
    enabled: !!listingId,
    placeholderData: (prev) => (prev?.listing.id === listingId ? prev : undefined),
  });
}

function useCalendarWrite<TInput>(listingId: string, kind: 'blocks' | 'prices') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) =>
      apiFetch<HostCalendarDto>(`/host/calendar/${listingId}/${kind}`, { method: 'PUT', body: input }),
    onSuccess: (dto) => {
      qc.setQueryData(hostKeys.calendar(dto.listing.id, dto.month), dto);
      void qc.invalidateQueries({ queryKey: hostKeys.dashboard() });
    },
    // e.g. 409 DATES_UNAVAILABLE: someone booked meanwhile, so show the current calendar.
    onError: () => qc.invalidateQueries({ queryKey: hostKeys.calendars(listingId) }),
  });
}

export const useSetBlocks = (listingId: string) => useCalendarWrite<SetBlocksInput>(listingId, 'blocks');
export const useSetPrices = (listingId: string) => useCalendarWrite<SetPricesInput>(listingId, 'prices');

// ---------------------------------------------------------------- onboarding

export function useHostOnboarding() {
  return useQuery({
    queryKey: hostKeys.onboarding(),
    queryFn: () => apiFetch<HostOnboardingDto>('/host/onboarding'),
  });
}

export function useSaveOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HostOnboardingInput) =>
      apiFetch<HostOnboardingDto>('/host/onboarding', { method: 'PUT', body: input }),
    onSuccess: (dto) => qc.setQueryData(hostKeys.onboarding(), dto),
  });
}

export function useSubmitIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HostIdentityInput) =>
      apiFetch<HostOnboardingDto>('/host/onboarding/identity', { method: 'POST', body: input }),
    onSuccess: (dto) => {
      qc.setQueryData(hostKeys.onboarding(), dto);
      // MeDto.kycStatus changes too.
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

// ---------------------------------------------------------------- listings (Listings module endpoints)

export function useMyListings() {
  return useQuery({
    queryKey: hostKeys.listings(),
    queryFn: () => apiFetch<HostListingSummaryDto[]>('/listings/mine'),
  });
}

export function useCreateListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<HostListingDto>('/listings', { method: 'POST', body: {} }),
    onSuccess: (dto) => {
      qc.setQueryData(hostKeys.listing(dto.id), dto);
      void qc.invalidateQueries({ queryKey: hostKeys.listings() });
      void qc.invalidateQueries({ queryKey: hostKeys.dashboard() });
    },
  });
}

export function useListingStatusAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pause' | 'unpause' | 'submit' }) =>
      apiFetch<HostListingDto>(`/listings/${id}/${action}`, { method: 'POST' }),
    onSuccess: (dto) => {
      qc.setQueryData(hostKeys.listing(dto.id), dto);
      void qc.invalidateQueries({ queryKey: hostKeys.listings() });
    },
  });
}

export function useEditListing(id: string) {
  return useQuery({
    queryKey: hostKeys.listing(id),
    queryFn: () => apiFetch<HostListingDto>(`/listings/${id}/edit`),
  });
}

export function useUpdateListing(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateListingInput) =>
      apiFetch<HostListingDto>(`/listings/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (dto) => {
      qc.setQueryData(hostKeys.listing(id), dto);
      void qc.invalidateQueries({ queryKey: hostKeys.listings() });
      void qc.invalidateQueries({ queryKey: hostKeys.calendars(id) });
    },
  });
}

// ---------------------------------------------------------------- photos (Listings module endpoints)

/** Keeps listing.photos in the editor cache in step with photo calls. */
function setPhotos(qc: QueryClient, listingId: string, update: (photos: ListingPhotoDto[]) => ListingPhotoDto[]) {
  qc.setQueryData<HostListingDto>(hostKeys.listing(listingId), (l) => (l ? { ...l, photos: update(l.photos) } : l));
}

async function imageSize(file: File): Promise<{ width: number | null; height: number | null }> {
  try {
    const bmp = await createImageBitmap(file);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return { width: null, height: null }; // e.g. HEIC in browsers that can't decode it
  }
}

/** upload-url -> PUT the file to storage -> attach. */
export function useUploadPhoto(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const target = await apiFetch<UploadTarget>(`/listings/${listingId}/photos/upload-url`, {
        method: 'POST',
        body: { contentType: file.type, size: file.size, fileName: file.name.slice(0, 200) },
      });
      const put = await fetch(target.uploadUrl, { method: 'PUT', headers: target.headers, body: file });
      if (!put.ok) throw new Error(`Upload of ${file.name} failed (${put.status})`);
      const size = await imageSize(file);
      const body: AttachPhotoInput = { key: target.key, ...size };
      return apiFetch<ListingPhotoDto>(`/listings/${listingId}/photos`, { method: 'POST', body });
    },
    onSuccess: (photo) => setPhotos(qc, listingId, (ps) => [...ps.filter((p) => p.id !== photo.id), photo]),
    onSettled: () => qc.invalidateQueries({ queryKey: hostKeys.listing(listingId) }),
  });
}

export function useUpdatePhotoCaption(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, caption }: { photoId: string; caption: string | null }) =>
      apiFetch<ListingPhotoDto>(`/listings/${listingId}/photos/${photoId}`, { method: 'PATCH', body: { caption } }),
    onSuccess: (photo) => setPhotos(qc, listingId, (ps) => ps.map((p) => (p.id === photo.id ? photo : p))),
  });
}

export function useReorderPhotos(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoIds: string[]) =>
      apiFetch<ListingPhotoDto[]>(`/listings/${listingId}/photos/order`, { method: 'PUT', body: { photoIds } }),
    onMutate: (photoIds) => {
      const prev = qc.getQueryData<HostListingDto>(hostKeys.listing(listingId));
      setPhotos(qc, listingId, (ps) =>
        photoIds.map((id) => ps.find((p) => p.id === id)).filter((p): p is ListingPhotoDto => !!p),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(hostKeys.listing(listingId), ctx.prev);
    },
    onSuccess: (photos) => setPhotos(qc, listingId, () => photos),
  });
}

export function useDeletePhoto(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => apiFetch(`/listings/${listingId}/photos/${photoId}`, { method: 'DELETE' }),
    onSuccess: (_r, photoId) => setPhotos(qc, listingId, (ps) => ps.filter((p) => p.id !== photoId)),
    onSettled: () => qc.invalidateQueries({ queryKey: hostKeys.listing(listingId) }),
  });
}
