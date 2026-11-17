import { CreditCard } from 'lucide-react';
import Link from 'next/link';
import { Note, SectionHeading } from './section';

/** MVP: no saved cards. Cards, PromptPay and mobile banking are chosen at checkout. */
export function PaymentsSection() {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeading>Payment methods</SectionHeading>
      <div className="flex items-start gap-3.5 rounded-[14px] border border-line p-4">
        <CreditCard aria-hidden className="mt-0.5 size-[22px] shrink-0 text-ink-2" />
        <div>
          <p className="m-0 font-semibold">You choose how to pay at checkout</p>
          <p className="m-0 text-sm text-muted">
            Pay by card, PromptPay QR or mobile banking when you book. Nothing is saved to your account.
          </p>
        </div>
      </div>
      <Note>
        Card details are kept by our payment provider, never on Hongwang’s servers. Hosting payouts are set up from your{' '}
        <Link href="/host">hosting dashboard</Link>.
      </Note>
    </div>
  );
}
