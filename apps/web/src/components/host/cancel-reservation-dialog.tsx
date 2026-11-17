'use client';

import type { BookingDto } from '@hongwang/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api/client';
import { formatStayShort, formatTHB } from '@/lib/format';
import { useCancelBooking, useCancellationQuote } from '@/lib/queries/host';
import { Button } from '@/components/ui/button';
import { Banner, Skeleton } from '@/components/ui/feedback';
import { Field, Select } from '@/components/ui/field';
import { Dialog, DialogClose, DialogFooter } from '@/components/ui/overlays';

const REASONS = [
  'The place needs urgent repairs',
  'I’m worried about this guest',
  'Personal emergency',
  'The dates were booked by mistake',
  'Other',
];

/** Host cancels a confirmed stay (design C6): penalty from GET /bookings/:id/cancellation-quote. */
export function CancelReservationDialog({ booking }: { booking: BookingDto }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const quote = useCancellationQuote(booking.id, open);
  const cancel = useCancelBooking();
  const first = booking.guest.firstName;

  async function onConfirm() {
    setTouched(true);
    if (!reason) return;
    try {
      await cancel.mutateAsync({ id: booking.id, reason });
      setOpen(false);
      toast.success(`Reservation cancelled. ${first} gets a full refund.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTouched(false);
      }}
      title={`Cancel ${first}’s stay?`}
      trigger={<Button variant="danger-outline">Cancel reservation</Button>}
    >
      {quote.isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      ) : quote.error || !quote.data ? (
        <Banner tone="danger">{errorMessage(quote.error, 'Couldn’t work out the refund. Please try again.')}</Banner>
      ) : (
        <ul className="m-0 flex flex-col gap-1 pl-[18px] text-ink-2">
          <li>
            {first} gets a full refund of {formatTHB(quote.data.refundTotal)}, whatever your policy says.
          </li>
          <li>
            You pay a {formatTHB(quote.data.hostPenalty)} fee (10% of the payout), taken from your next payout.
          </li>
          <li>You won’t receive the {formatTHB(booking.pricing.hostPayout)} payout for {formatStayShort(booking.checkIn, booking.checkOut)}.</li>
          <li>A note that you cancelled appears on the listing for 12 months.</li>
        </ul>
      )}
      <Field
        label="Reason (shared with our team, not the guest)"
        error={touched && !reason ? 'Choose a reason' : undefined}
      >
        {(p) => (
          <Select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <p className="m-0 text-sm text-muted">
        Emergencies like floods or burst pipes don’t count against you if you send photos to support.
      </p>
      <DialogFooter className="justify-stretch">
        <DialogClose asChild>
          <Button variant="outline-dark" size="lg" className="flex-[1_1_160px]">
            Keep reservation
          </Button>
        </DialogClose>
        <Button
          variant="danger"
          size="lg"
          className="flex-[1_1_200px]"
          loading={cancel.isPending}
          disabled={!quote.data}
          onClick={onConfirm}
        >
          Cancel and refund {first}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
