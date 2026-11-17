'use client';

import type { BookingDto } from '@hongwang/shared';
import Link from 'next/link';
import { formatStay, formatTHB } from '@/lib/format';
import { BookingStatusBadge } from './status-badge';

const th = 'border-b border-line px-3 py-2.5 font-semibold';
const td = 'border-b border-line-soft px-3 py-3.5';

/** "Upcoming stays" table (design C2). */
export function UpcomingTable({ bookings }: { bookings: BookingDto[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-ink-2">
            <th scope="col" className={`${th} pl-0`}>
              Guest
            </th>
            <th scope="col" className={th}>
              Listing
            </th>
            <th scope="col" className={th}>
              Dates
            </th>
            <th scope="col" className={th}>
              Status
            </th>
            <th scope="col" className={`${th} pr-0 text-right`}>
              Payout
            </th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b, i) => {
            const last = i === bookings.length - 1 ? 'border-b-0' : '';
            return (
              <tr key={b.id}>
                <td className={`${td} ${last} pl-0 font-medium`}>
                  <Link href={`/host/reservations/${b.id}`}>{b.guest.displayName}</Link>
                </td>
                <td className={`${td} ${last}`}>{b.listing.title}</td>
                <td className={`${td} ${last}`}>{formatStay(b.checkIn, b.checkOut)}</td>
                <td className={`${td} ${last}`}>
                  <BookingStatusBadge booking={b} className="text-[13px]" />
                </td>
                <td className={`${td} ${last} pr-0 text-right font-tabular`}>{formatTHB(b.pricing.hostPayout)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
