import {
  AMENITY_LABELS,
  CANCELLATION_POLICY_INFO,
  PROPERTY_TYPE_LABELS,
  ROOM_TYPE_LABELS,
  type ListingDetailDto,
} from '@hongwang/shared';
import { Check, Star } from 'lucide-react';
import { Avatar } from '@/components/ui/surfaces';
import { pluralize } from '@/lib/format';

/** Presentational sections of the listing page (design A2). Server components. */

const section = 'border-b border-line py-7';
const h2 = 'm-0 text-xl font-semibold';

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export function floorLabel(floor: number | null) {
  if (floor === null) return null;
  if (floor === 0) return 'Ground floor';
  if (floor < 0) return `Basement ${Math.abs(floor)}`;
  return `${ordinal(floor)} floor`;
}

export function HostSummary({ listing }: { listing: ListingDetailDto }) {
  const { host } = listing;
  const since = new Date(host.hostingSince).getUTCFullYear();
  const meta = [host.identityVerified ? 'ID verified' : null, `Hosting since ${since}`].filter(Boolean).join(' · ');
  return (
    <section aria-label="Host" className="flex items-center gap-4 border-b border-line pb-7">
      <Avatar name={host.displayName} initials={host.initials} src={host.avatarUrl} size={56} />
      <div>
        <h2 className="m-0 text-xl leading-[1.3] font-semibold">
          {ROOM_TYPE_LABELS[listing.roomType]} hosted by {host.firstName}
        </h2>
        <p className="m-0 mt-0.5 text-muted">{meta}</p>
      </div>
    </section>
  );
}

export function AboutPlace({ listing }: { listing: ListingDetailDto }) {
  const facts = [
    [PROPERTY_TYPE_LABELS[listing.propertyType], listing.sizeSqm ? `${listing.sizeSqm} m²` : null].filter(Boolean).join(' · '),
    listing.bedrooms > 0 ? pluralize(listing.bedrooms, 'bedroom') : 'Studio',
    pluralize(listing.beds, 'bed'),
    `${listing.bathrooms} bathroom${listing.bathrooms === 1 ? '' : 's'}`,
    `Sleeps ${listing.maxGuests}`,
    floorLabel(listing.floor),
  ].filter(Boolean) as string[];
  return (
    <section aria-label="About this place" className={`${section} flex flex-col gap-[18px]`}>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {facts.map((f) => (
          <li key={f} className="rounded-full bg-canvas px-3.5 py-2 text-sm font-medium">
            {f}
          </li>
        ))}
      </ul>
      {listing.description && <p className="m-0 max-w-[64ch] whitespace-pre-line">{listing.description}</p>}
    </section>
  );
}

export function Amenities({ listing }: { listing: ListingDetailDto }) {
  if (listing.amenities.length === 0) return null;
  return (
    <section aria-labelledby="amenities-title" className={section}>
      <h2 id="amenities-title" className={`${h2} mb-4`}>
        What this place offers
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-3.5 p-0 sm:grid-cols-2">
        {listing.amenities.map((a) => (
          <li key={a} className="flex items-center gap-2.5">
            <Check aria-hidden className="size-[18px] shrink-0 text-brand" strokeWidth={2.2} />
            {AMENITY_LABELS[a]}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BeforeYouBook({ listing }: { listing: ListingDetailDto }) {
  const policy = CANCELLATION_POLICY_INFO[listing.cancellationPolicy];
  const rules = listing.houseRules;
  const ruleLine = [
    rules.smoking ? 'Smoking allowed' : 'No smoking',
    rules.pets ? 'Pets allowed' : 'No pets',
    rules.events ? 'Events allowed' : 'No parties or events',
  ].join(' · ');
  return (
    <section aria-labelledby="before-title" className={section}>
      <h2 id="before-title" className={`${h2} mb-3.5`}>
        Before you book
      </h2>
      <dl className="m-0 grid grid-cols-1 gap-3.5">
        <div>
          <dt className="font-semibold">{policy.label} cancellation</dt>
          <dd className="m-0 mt-0.5 text-ink-2">{policy.summary}</dd>
        </div>
        <div>
          <dt className="font-semibold">Self check-in after {listing.checkInFrom}</dt>
          <dd className="m-0 mt-0.5 text-ink-2">
            Check out by {listing.checkOutBy}. Access details arrive once your payment clears.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Contact details stay private</dt>
          <dd className="m-0 mt-0.5 text-ink-2">
            The exact address and {listing.host.firstName}’s phone unlock when your booking is confirmed. Until then, message
            through Hongwang.
          </dd>
        </div>
        <div>
          <dt className="font-semibold">House rules</dt>
          <dd className="m-0 mt-0.5 text-ink-2">
            {ruleLine}
            {rules.notes ? <span className="mt-1 block whitespace-pre-line">{rules.notes}</span> : null}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function ReviewsSummary({ listing }: { listing: ListingDetailDto }) {
  const has = listing.reviewCount > 0 && listing.rating !== null;
  return (
    <section id="reviews" aria-labelledby="reviews-title" className={section}>
      <h2 id="reviews-title" className={`${h2} mb-2 flex items-center gap-2`}>
        <Star aria-hidden className="size-[18px] fill-ink text-ink" />
        {has ? `${listing.rating!.toFixed(2)} · ${pluralize(listing.reviewCount, 'review')}` : 'No reviews yet'}
      </h2>
      <p className="m-0 max-w-[64ch] text-ink-2">
        {has
          ? 'Ratings come from guests who completed a stay. Written reviews are coming soon.'
          : 'Be one of the first guests to stay here. Guests rate their stay after check-out.'}
      </p>
    </section>
  );
}
