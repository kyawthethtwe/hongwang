'use client';

import {
  IDEMPOTENCY_KEY_HEADER,
  type BookingDto,
  type CancelBookingInput,
  type CreateBookingInput,
  type MyBookingsQuery,
  type PaymentIntentDto,
  type PaymentMethod,
  type QuoteDto,
  type QuoteInput,
  type RefundQuote,
} from '@hongwang/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError, apiFetch } from '@/lib/api/client';

/**
 * Guest-side booking and payment queries. Owner: Bookings & Payments module.
 * (Host-side reservation hooks live in src/lib/queries/host.ts.)
 */
export type TripsTab = MyBookingsQuery['tab'];

export const bookingKeys = {
  all: ['bookings'] as const,
  mine: (tab: TripsTab) => ['bookings', 'mine', tab] as const,
  detail: (id: string) => ['bookings', 'detail', id] as const,
  cancellationQuote: (id: string) => ['bookings', 'detail', id, 'cancellation-quote'] as const,
  paymentIntent: (id: string, method: PaymentMethod) => ['bookings', 'detail', id, 'payment-intent', method] as const,
  quote: (q: QuoteInput) => ['bookings', 'quote', q.listingId, q.checkIn, q.checkOut, q.guests] as const,
};

/** After any booking change: refresh trips, the booking, and listing availability (nights freed or taken). */
function afterBookingChange(qc: QueryClient, dto?: BookingDto) {
  if (dto) qc.setQueryData(bookingKeys.detail(dto.id), dto);
  void qc.invalidateQueries({ queryKey: ['bookings', 'mine'] });
  void qc.invalidateQueries({ queryKey: ['bookings', 'quote'] });
  void qc.invalidateQueries({ queryKey: ['listings', 'availability'] });
}

export function useBooking(id: string, opts: { pollMs?: number | false } = {}) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: ({ signal }) => apiFetch<BookingDto>(`/bookings/${id}`, { signal }),
    refetchInterval: opts.pollMs ?? false,
  });
}

export function useMyBookings(tab: TripsTab) {
  return useQuery({
    queryKey: bookingKeys.mine(tab),
    queryFn: ({ signal }) => apiFetch<BookingDto[]>('/bookings/mine', { query: { tab }, signal }),
  });
}

/** Live price and availability for a stay (POST /bookings/quote). Pass null until both dates are set. */
export function useStayQuote(input: QuoteInput | null) {
  return useQuery({
    queryKey: input ? bookingKeys.quote(input) : ['bookings', 'quote', 'none'],
    queryFn: ({ signal }) => apiFetch<QuoteDto>('/bookings/quote', { method: 'POST', body: input, signal }),
    enabled: !!input,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/** No response, or a 5xx: the booking may or may not exist, so retry with the same Idempotency-Key. */
export const isRetryableCreateError = (err: unknown) => err instanceof ApiError && (err.status === 0 || err.status >= 500);

/**
 * POST /bookings with an Idempotency-Key. Retries twice on network errors and 5xx; that's safe
 * because every retry carries the same key, so the API answers with the booking it already made.
 */
export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateBookingInput; idempotencyKey: string }) =>
      apiFetch<BookingDto>('/bookings', { method: 'POST', body: input, headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey } }),
    retry: (failures, err) => failures < 2 && isRetryableCreateError(err),
    onSuccess: (dto) => afterBookingChange(qc, dto),
  });
}

export function useCancellationQuote(id: string, enabled: boolean) {
  return useQuery({
    queryKey: bookingKeys.cancellationQuote(id),
    queryFn: ({ signal }) => apiFetch<RefundQuote>(`/bookings/${id}/cancellation-quote`, { signal }),
    enabled,
    staleTime: 0,
  });
}

export function useCancelBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CancelBookingInput) => apiFetch<BookingDto>(`/bookings/${id}/cancel`, { method: 'POST', body: input }),
    onSuccess: (dto) => afterBookingChange(qc, dto),
  });
}

/** Creates (or reuses) the PaymentIntent for a booking on hold. One per method choice. */
export function usePaymentIntent(bookingId: string, method: PaymentMethod, enabled: boolean) {
  return useQuery({
    queryKey: bookingKeys.paymentIntent(bookingId, method),
    queryFn: () => apiFetch<PaymentIntentDto>('/payments/intent', { method: 'POST', body: { bookingId, method } }),
    enabled,
    staleTime: Infinity,
    // The API updates the same PaymentIntent when the method changes: never reuse an old answer.
    gcTime: 0,
    retry: false,
  });
}

/** Dev-only simulated payment (no Stripe keys): confirms through the webhook's code path. */
export function useSimulatePayment(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<BookingDto>(`/payments/${bookingId}/simulate`, { method: 'POST' }),
    onSuccess: (dto) => afterBookingChange(qc, dto),
  });
}
