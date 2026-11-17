'use client';

import { CANCELLATION_POLICY_INFO, type BookingDto, type RefundQuote } from '@hongwang/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/feedback';
import { Field, Select } from '@/components/ui/field';
import { Dialog, DialogFooter } from '@/components/ui/overlays';
import { errorMessage } from '@/lib/api/client';
import { formatDay, formatTHB, pluralize } from '@/lib/format';
import { useCancelBooking, useCancellationQuote } from '@/lib/queries/bookings';
import { policyLabel } from './booking-format';

const REASONS = ['My plans changed', 'I found another place', 'Something is wrong with the listing', 'Other'];

/** Explains the refund in words, above the table (design B2). */
function refundExplanation(b: BookingDto, q: RefundQuote): string {
  if (b.status !== 'confirmed') {
    return b.status === 'requested'
      ? `You haven’t been charged, so there’s nothing to refund. ${b.host.firstName} is told the request is withdrawn.`
      : 'You haven’t been charged, so there’s nothing to refund. The dates go back on sale straight away.';
  }
  const info = CANCELLATION_POLICY_INFO[b.cancellationPolicy];
  const start = `Your policy is ${policyLabel(b.cancellationPolicy)}: a full refund until ${formatDay(q.freeCancellationUntil)}.`;
  if (q.kind === 'full') return `${start} You’re inside that window, so you get everything back.`;
  if (q.kind === 'partial')
    return `${start} Check-in is now less than ${pluralize(info.fullRefundDays, 'day')} away, so you get half the nightly total back.`;
  return `${start} Check-in is too close for a refund under this policy.`;
}

/** Guest cancellation with the refund table from GET /bookings/:id/cancellation-quote. */
export function CancelBookingDialog({ booking, open, onOpenChange }: { booking: BookingDto; open: boolean; onOpenChange: (o: boolean) => void }) {
  const quote = useCancellationQuote(booking.id, open);
  const cancel = useCancelBooking(booking.id);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const charged = booking.status === 'confirmed';
  const q = quote.data;
  const isRequest = booking.status === 'requested';

  const confirmLabel = !charged
    ? isRequest
      ? 'Cancel request'
      : 'Cancel booking'
    : q && q.refundTotal > 0
      ? `Cancel and refund ${formatTHB(q.refundTotal)}`
      : 'Cancel without refund';

  function submit() {
    setTouched(true);
    if (!reason) return;
    cancel.mutate(
      { reason },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success(isRequest ? 'Request cancelled' : 'Booking cancelled');
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) cancel.reset();
        onOpenChange(o);
      }}
      title={isRequest ? 'Cancel this request?' : 'Cancel this booking?'}
      className="max-w-xl"
    >
      {quote.isLoading ? (
        <Skeleton className="h-40" />
      ) : quote.isError ? (
        <p role="alert" className="m-0 text-danger-ink">
          {errorMessage(quote.error, 'We couldn’t work out the refund.')}
        </p>
      ) : q ? (
        <>
          <p className="m-0 text-ink-2">{refundExplanation(booking, q)}</p>
          {charged && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-ink-2">
                    <th scope="col" className="border-b border-line py-2 font-semibold">Item</th>
                    <th scope="col" className="border-b border-line py-2 text-right font-semibold">Paid</th>
                    <th scope="col" className="border-b border-line py-2 text-right font-semibold">Refund</th>
                  </tr>
                </thead>
                <tbody className="font-tabular">
                  {q.lines.map((l) => (
                    <tr key={l.label}>
                      <td className="py-2">{l.label === 'Nights' ? pluralize(booking.nights, 'night') : l.label}</td>
                      <td className="py-2 text-right">{formatTHB(l.paid)}</td>
                      <td className="py-2 text-right">{formatTHB(l.refund)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="border-t border-line py-2.5">Total</td>
                    <td className="border-t border-line py-2.5 text-right">{formatTHB(booking.pricing.total)}</td>
                    <td className="border-t border-line py-2.5 text-right">{formatTHB(q.refundTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      <Field label="Reason" error={touched && !reason ? 'Choose a reason' : undefined}>
        {(p) => (
          <Select {...p} value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason</option>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        )}
      </Field>

      {cancel.isError && (
        <p role="alert" className="m-0 rounded-field bg-danger-bg px-3.5 py-2.5 text-sm font-medium text-danger-ink">
          {errorMessage(cancel.error)}
        </p>
      )}

      <DialogFooter className="justify-stretch">
        <Button variant="outline-dark" size="lg" className="flex-[1_1_160px]" onClick={() => onOpenChange(false)}>
          {isRequest ? 'Keep request' : 'Keep booking'}
        </Button>
        <Button variant="danger" size="lg" className="flex-[1_1_200px]" loading={cancel.isPending} disabled={!q} onClick={submit}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
