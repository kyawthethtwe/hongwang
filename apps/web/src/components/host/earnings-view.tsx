'use client';

import { addDays } from '@hongwang/shared';
import Link from 'next/link';
import { formatDay, formatStayShort, formatTHB, pluralize } from '@/lib/format';
import { useHostReservations } from '@/lib/queries/host';
import { Badge, Banner } from '@/components/ui/feedback';
import { PageTitle, Stat } from '@/components/ui/surfaces';
import { PageSkeleton, QueryError } from './query-state';

const th = 'border-b border-line px-3 py-3 font-semibold';
const td = 'border-b border-line-soft px-3 py-3.5';

/**
 * Earnings, phase 1 (C7 is phase 2): upcoming payouts derived from confirmed stays.
 * Payout date = check-in + 1 day. No money moves yet: Stripe Connect payouts come in phase 2.
 */
export function EarningsView() {
  const { data, error, isLoading, refetch } = useHostReservations({ status: 'confirmed' });

  const rows = (data ?? [])
    .map((b) => ({ b, date: addDays(b.checkIn, 1) }))
    .sort((x, y) => x.date.localeCompare(y.date));
  const total = rows.reduce((s, r) => s + r.b.pricing.hostPayout, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Earnings</PageTitle>
      <Banner tone="info">
        Bank payouts through Stripe Connect arrive in phase 2. Until then this page shows what each confirmed stay will
        pay you and when.
      </Banner>
      {isLoading ? (
        <PageSkeleton rows={2} />
      ) : error || !data ? (
        <QueryError error={error} retry={() => void refetch()} what="your earnings" />
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            <Stat
              label="Upcoming payouts"
              value={formatTHB(total)}
              sub={rows.length ? `${pluralize(rows.length, 'stay')}, next one ${formatDay(rows[0]!.date)}` : 'No confirmed stays yet'}
            />
          </section>
          <section aria-labelledby="payouts-title" className="rounded-panel border border-line bg-surface px-[22px] pt-4 pb-5">
            <h2 id="payouts-title" className="m-0 mb-2 text-xl font-semibold">
              Upcoming
            </h2>
            {rows.length === 0 ? (
              <p className="m-0 py-4 text-muted">
                Payouts appear here once a guest’s payment is confirmed. See <Link href="/host">Today</Link> for requests.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-ink-2">
                      <th scope="col" className={`${th} pl-0`}>
                        Payout date
                      </th>
                      <th scope="col" className={th}>
                        Guest
                      </th>
                      <th scope="col" className={th}>
                        Listing
                      </th>
                      <th scope="col" className={th}>
                        Stay
                      </th>
                      <th scope="col" className={th}>
                        Status
                      </th>
                      <th scope="col" className={`${th} pr-0 text-right`}>
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ b, date }) => (
                      <tr key={b.id}>
                        <td className={`${td} pl-0 font-medium`}>{formatDay(date)}</td>
                        <td className={td}>
                          <Link href={`/host/reservations/${b.id}`}>{b.guest.displayName}</Link>
                        </td>
                        <td className={td}>{b.listing.title}</td>
                        <td className={td}>{formatStayShort(b.checkIn, b.checkOut)}</td>
                        <td className={td}>
                          <Badge tone="info" className="text-[13px]">
                            Scheduled
                          </Badge>
                        </td>
                        <td className={`${td} pr-0 text-right font-semibold font-tabular`}>
                          {formatTHB(b.pricing.hostPayout)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="m-0 mt-3.5 text-[13px] text-muted">
              Payouts release 24 hours after check-in. If a guest reports a problem, that payout waits until support
              decides.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
