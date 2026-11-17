import { formatTHB, type BookingDto, type IsoDate } from '@hongwang/shared';
import { Check, X } from 'lucide-react';
import { countdown, formatDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { formatMoment, hoursLeft } from './booking-format';

export type TimelineState = 'done' | 'next' | 'later' | 'stopped';
export interface TimelineStep {
  title: string;
  when: string;
  state: TimelineState;
}

/** "Your stay" steps for the guest (design B2): Booked → Paid → Check in → Check out. */
export function stayTimeline(b: BookingDto, now: number, today: IsoDate): TimelineStep[] {
  const host = b.host.firstName;
  const u = b.unlocked;
  const booked: TimelineStep = {
    title: b.instant ? 'Reserved' : 'Request sent',
    when: `${formatMoment(b.createdAt)}${b.instant ? ' · dates held for 15 minutes' : ''}`,
    state: 'done',
  };
  const paidAt = b.payment?.paidAt ?? b.confirmedAt;
  const paid: TimelineStep | null = paidAt
    ? { title: `Paid ${formatTHB(b.pricing.total)}`, when: `${formatMoment(paidAt)} · booking confirmed`, state: 'done' }
    : null;
  const checkInDone = (b.status === 'confirmed' || b.status === 'completed') && today >= b.checkIn;
  const checkOutDone = b.status === 'completed' || (b.status === 'confirmed' && today >= b.checkOut);
  const checkIn: TimelineStep = {
    title: 'Check in',
    when: `${formatDay(b.checkIn)}${u ? ` from ${u.checkInFrom}` : ''}`,
    state: checkInDone ? 'done' : 'later',
  };
  const checkOut: TimelineStep = {
    title: 'Check out',
    when: `${formatDay(b.checkOut)}${u ? ` by ${u.checkOutBy}` : ''}`,
    state: checkOutDone ? 'done' : 'later',
  };
  const stopped = (title: string, when: string): TimelineStep => ({ title, when, state: 'stopped' });

  let steps: TimelineStep[];
  switch (b.status) {
    case 'requested': {
      const left = b.requestExpiresAt ? hoursLeft(b.requestExpiresAt, now) : null;
      steps = [
        booked,
        { title: `${host} accepts`, when: left ? `${host} has ${left} to respond` : 'Waiting for an answer', state: 'next' },
        { title: 'Pay within 15 minutes', when: 'You’ll get an email with a payment link', state: 'later' },
        checkIn,
        checkOut,
      ];
      break;
    }
    case 'payment_hold': {
      const live = b.holdExpiresAt && Date.parse(b.holdExpiresAt) > now;
      steps = [
        booked,
        {
          title: `Pay ${formatTHB(b.pricing.total)}`,
          when: live ? `Pay within ${countdown(b.holdExpiresAt!, now)}` : 'The hold ran out',
          state: 'next',
        },
        checkIn,
        checkOut,
      ];
      break;
    }
    case 'confirmed':
    case 'completed':
      steps = [booked, ...(paid ? [paid] : []), checkIn, checkOut];
      break;
    case 'cancelled': {
      const who = b.cancelledBy === 'guest' ? 'Cancelled by you' : b.cancelledBy === 'host' ? `Cancelled by ${host}` : 'Cancelled';
      const refund = b.refundAmount ? `${formatTHB(b.refundAmount)} refunded` : paid ? 'no refund' : 'no charge';
      steps = [booked, ...(paid ? [paid] : []), stopped(who, `${b.cancelledAt ? formatMoment(b.cancelledAt) : ''} · ${refund}`)];
      break;
    }
    case 'rejected':
      steps = [booked, stopped(`Declined by ${host}`, 'You were not charged')];
      break;
    case 'expired':
      steps = [booked, stopped('Expired', b.holdExpiresAt ? 'The payment hold ran out · no charge' : `${host} didn’t respond in time · no charge`)];
      break;
  }
  // The first step that isn't done yet is the next one.
  const firstOpen = steps.findIndex((s) => s.state === 'later');
  if (firstOpen >= 0 && !steps.some((s) => s.state === 'next' || s.state === 'stopped')) steps[firstOpen]!.state = 'next';
  return steps;
}

export function StayTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <section aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="m-0 mb-3.5 text-xl font-semibold">
        Your stay
      </h2>
      <ol className="m-0 flex list-none flex-col p-0">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3.5">
            <span className="flex flex-col items-center">
              <span
                className={cn(
                  'box-border flex size-6 flex-none items-center justify-center rounded-full border-2 text-white',
                  s.state === 'done' && 'border-brand bg-brand',
                  s.state === 'next' && 'border-brand bg-surface',
                  s.state === 'later' && 'border-line-strong bg-surface',
                  s.state === 'stopped' && 'border-danger bg-danger',
                )}
              >
                {s.state === 'done' && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
                {s.state === 'stopped' && <X aria-hidden className="size-3.5" strokeWidth={3} />}
              </span>
              {i < steps.length - 1 && <span aria-hidden className="min-h-[22px] w-0.5 flex-1 bg-line-card" />}
            </span>
            <span className="pb-4">
              <span className="block font-semibold">
                {s.title}
                <span className="sr-only">
                  {s.state === 'done' ? ' (done)' : s.state === 'next' ? ' (next)' : s.state === 'stopped' ? '' : ' (later)'}
                </span>
              </span>
              <span className="block text-sm text-muted">{s.when}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
