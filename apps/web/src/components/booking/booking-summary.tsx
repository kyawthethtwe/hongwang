import { ROOM_TYPE_LABELS, type BookingDto } from '@hongwang/shared';
import { Star } from 'lucide-react';
import { ListingImage, tintFor } from '@/components/listings/listing-image';
import { formatStay, pluralize } from '@/lib/format';
import { PriceLines } from './price-lines';

/** "Booking summary" aside on checkout (design A3). */
export function BookingSummary({ booking }: { booking: BookingDto }) {
  const l = booking.listing;
  return (
    <aside aria-label="Booking summary" className="min-w-0 flex-[1_1_340px]">
      <div className="flex flex-col gap-4 rounded-sheet border border-line-card p-5">
        <div className="flex items-center gap-3.5">
          <div className="relative h-[84px] w-28 flex-none overflow-hidden rounded-[12px]">
            <ListingImage src={l.coverPhotoUrl} alt="" sizes="112px" tint={tintFor(l.id)} label="" />
          </div>
          <div className="min-w-0">
            <p className="m-0 leading-[1.35] font-semibold">{l.title}</p>
            <p className="m-0 mt-0.5 text-sm text-muted">
              {ROOM_TYPE_LABELS[l.roomType]} · {l.area}, Bangkok
            </p>
            {l.rating !== null && (
              <p className="m-0 mt-0.5 flex items-center gap-1 text-sm">
                <Star aria-hidden className="size-3.5 fill-ink" />
                {l.rating.toFixed(2)} · {pluralize(l.reviewCount, 'review')}
              </p>
            )}
          </div>
        </div>
        <dl className="m-0 flex flex-col gap-2.5 border-t border-line pt-4">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Dates</dt>
            <dd className="m-0 text-right">{formatStay(booking.checkIn, booking.checkOut)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-2">Guests</dt>
            <dd className="m-0">{booking.guests}</dd>
          </div>
        </dl>
        <div className="border-t border-line pt-4">
          <PriceLines pricing={booking.pricing} totalLabel="Total (THB)" />
        </div>
        <p className="m-0 text-[13px] text-muted">Price locked when you reserved · Booking ref {booking.ref}</p>
      </div>
    </aside>
  );
}
