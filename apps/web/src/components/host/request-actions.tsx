'use client';

import type { BookingDto } from '@hongwang/shared';
import { ERROR_CODES } from '@hongwang/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '@/lib/api/client';
import { useApproveBooking, useRejectBooking } from '@/lib/queries/host';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { Dialog, DialogClose, DialogFooter } from '@/components/ui/overlays';
import { cn } from '@/lib/utils';

export type RequestOutcome = 'approved' | 'declined';

/** Toast text for approve/reject failures; 409 DATES_UNAVAILABLE gets its own wording. */
export function approveErrorMessage(err: unknown) {
  if (err instanceof ApiError && err.code === ERROR_CODES.datesUnavailable) {
    return 'Those dates were just taken by another booking, so this request can’t be approved.';
  }
  return errorMessage(err);
}

/**
 * Decline (with a Dialog for an optional reason) and Approve buttons for a booking request.
 * POST /bookings/:id/reject and /bookings/:id/approve (Bookings module).
 */
export function RequestActions({
  booking,
  onDone,
  className,
}: {
  booking: BookingDto;
  onDone?: (outcome: RequestOutcome, dto: BookingDto) => void;
  className?: string;
}) {
  const approve = useApproveBooking();
  const reject = useRejectBooking();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const first = booking.guest.firstName;

  async function onApprove() {
    try {
      const dto = await approve.mutateAsync({ id: booking.id });
      toast.success(`Approved. ${first} has 15 minutes to pay.`);
      onDone?.('approved', dto);
    } catch (err) {
      toast.error(approveErrorMessage(err));
    }
  }

  async function onReject() {
    try {
      const dto = await reject.mutateAsync({ id: booking.id, reason: reason.trim() || undefined });
      setOpen(false);
      setReason('');
      toast.success(`Declined. ${first} has been told.`);
      onDone?.('declined', dto);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const busy = approve.isPending || reject.isPending;

  return (
    <div className={cn('flex gap-2', className)}>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Decline ${first}’s request?`}
        description={`${first} is told straight away and isn’t charged. The dates stay open for others.`}
        trigger={
          <Button variant="outline-dark" className="flex-1" disabled={busy}>
            Decline
          </Button>
        }
      >
        <Field label="Reason (optional)" hint={`Shared with ${first}. Keep it short and friendly.`}>
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The room isn’t available for those dates after all."
            />
          )}
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Keep request</Button>
          </DialogClose>
          <Button variant="dark" loading={reject.isPending} onClick={onReject}>
            Decline request
          </Button>
        </DialogFooter>
      </Dialog>
      <Button className="flex-1" loading={approve.isPending} disabled={busy} onClick={onApprove}>
        Approve
      </Button>
    </div>
  );
}
