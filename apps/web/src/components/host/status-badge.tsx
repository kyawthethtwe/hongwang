'use client';

import { BOOKING_STATUS_LABELS, type BookingDto, type ListingStatus } from '@hongwang/shared';
import { Badge } from '@/components/ui/feedback';
import { leftUntil, useNow } from './use-now';

type Tone = 'neutral' | 'brand' | 'warn' | 'danger' | 'info';

const BOOKING_TONE: Record<BookingDto['status'], Tone> = {
  requested: 'warn',
  payment_hold: 'warn',
  confirmed: 'brand',
  completed: 'neutral',
  rejected: 'neutral',
  expired: 'neutral',
  cancelled: 'danger',
};

/** Booking status pill, host wording ("Payment hold · 14 min left", "Cancelled by you"). */
export function BookingStatusBadge({
  booking,
  className,
}: {
  booking: Pick<BookingDto, 'status' | 'holdExpiresAt' | 'cancelledBy' | 'viewerRole'>;
  className?: string;
}) {
  const now = useNow(15_000);
  let label: string = BOOKING_STATUS_LABELS[booking.status];
  if (booking.status === 'payment_hold' && booking.holdExpiresAt) {
    const left = leftUntil(booking.holdExpiresAt, now);
    label = left === 'expired' ? 'Payment hold · ending' : `Payment hold · ${left} left`;
  }
  if (booking.status === 'cancelled' && booking.cancelledBy) {
    const byMe = booking.cancelledBy === booking.viewerRole;
    label = byMe ? 'Cancelled by you' : booking.cancelledBy === 'guest' ? 'Cancelled by guest' : 'Cancelled';
  }
  return (
    <Badge tone={BOOKING_TONE[booking.status]} className={className}>
      {label}
    </Badge>
  );
}

export const LISTING_STATUS: Record<ListingStatus, { label: string; tone: Tone }> = {
  published: { label: 'Published', tone: 'brand' },
  paused: { label: 'Paused', tone: 'neutral' },
  in_review: { label: 'In review', tone: 'warn' },
  draft: { label: 'Draft', tone: 'neutral' },
  rejected: { label: 'Changes requested', tone: 'danger' },
};

export function ListingStatusBadge({ status, className }: { status: ListingStatus; className?: string }) {
  const s = LISTING_STATUS[status];
  return (
    <Badge tone={s.tone} className={className}>
      {s.label}
    </Badge>
  );
}
