'use client';

import type { BookingDto } from '@hongwang/shared';
import { Badge } from '@/components/ui/feedback';

type Tone = 'neutral' | 'brand' | 'warn' | 'danger' | 'info';

/** Guest wording for a booking's status (design B1/B2): "Request sent", "Cancelled by you" ... */
export function guestStatus(b: Pick<BookingDto, 'status' | 'cancelledBy' | 'holdExpiresAt'>, now: number): { label: string; tone: Tone } {
  switch (b.status) {
    case 'requested':
      return { label: 'Request sent', tone: 'neutral' };
    case 'payment_hold':
      return b.holdExpiresAt && Date.parse(b.holdExpiresAt) <= now
        ? { label: 'Hold expired', tone: 'neutral' }
        : { label: 'Payment hold', tone: 'warn' };
    case 'confirmed':
      return { label: 'Confirmed', tone: 'brand' };
    case 'completed':
      return { label: 'Completed', tone: 'neutral' };
    case 'rejected':
      return { label: 'Declined by host', tone: 'neutral' };
    case 'expired':
      return { label: 'Expired', tone: 'neutral' };
    case 'cancelled':
      return {
        label: b.cancelledBy === 'guest' ? 'Cancelled by you' : b.cancelledBy === 'host' ? 'Cancelled by host' : 'Cancelled',
        tone: 'danger',
      };
  }
}

export function GuestStatusBadge({ booking, now, className }: { booking: BookingDto; now: number; className?: string }) {
  const s = guestStatus(booking, now);
  return (
    <Badge tone={s.tone} className={className}>
      {s.label}
    </Badge>
  );
}

/** The booking still occupies the guest's plans and can be cancelled by them. */
export const guestCanCancel = (b: Pick<BookingDto, 'status' | 'viewerRole'>) =>
  b.viewerRole === 'guest' && (b.status === 'requested' || b.status === 'payment_hold' || b.status === 'confirmed');
