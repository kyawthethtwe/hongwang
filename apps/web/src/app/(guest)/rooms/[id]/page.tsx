import type { ListingDetailDto } from '@hongwang/shared';
import { ChevronLeft, Star } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ListingAvailability } from '@/components/listings/listing-availability';
import { AboutPlace, Amenities, BeforeYouBook, HostSummary, ReviewsSummary } from '@/components/listings/listing-details';
import { ListingGallery } from '@/components/listings/listing-gallery';
import { ReserveCardSlot } from '@/components/listings/reserve-card-slot';
import { SavePill } from '@/components/listings/save-button';
import { ShareButton } from '@/components/listings/share-button';
import { LocationMap } from '@/components/map';
import { loadSearchParams, serializeSearch } from '@/components/search/search-params';
import { serverFetch } from '@/lib/api/server';
import { pluralize } from '@/lib/format';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One fetch per request, shared by generateMetadata and the page. */
const getListing = cache(async (id: string) =>
  UUID.test(id) ? serverFetch<ListingDetailDto | null>(`/listings/${id}`, { nullOn404: true }) : null,
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: 'Room not found' };
  const description = listing.description.slice(0, 160) || `${listing.title} in ${listing.area}, Bangkok`;
  return {
    title: listing.title,
    description,
    openGraph: {
      title: listing.title,
      description,
      images: listing.coverPhotoUrl ? [{ url: listing.coverPhotoUrl }] : undefined,
    },
  };
}

/** Listing detail (design A2). */
export default async function RoomPage({ params, searchParams }: Props) {
  const { id } = await params;
  const [listing, search] = await Promise.all([getListing(id), loadSearchParams(searchParams)]);
  if (!listing) notFound();

  const backHref = `/search${serializeSearch(search)}`;
  const where = [listing.area, listing.district, listing.province].filter((v, i, a) => v && a.indexOf(v) === i).join(', ');

  return (
    <div className="mx-auto box-border max-w-[1200px] px-4 pt-5 pb-14 sm:px-10">
      <Link href={backHref} className="inline-flex min-h-11 items-center gap-1.5 font-medium no-underline">
        <ChevronLeft aria-hidden className="size-[18px]" />
        Back to results
      </Link>

      <div className="mt-2 mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-display text-[30px] leading-[1.15] font-bold tracking-[-0.02em] sm:text-4xl">{listing.title}</h1>
          <p className="m-0 flex flex-wrap items-center gap-2 text-ink-2">
            {listing.rating !== null ? (
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-ink">
                  <Star aria-hidden className="size-[15px] fill-ink text-ink" />
                  {listing.rating.toFixed(2)}
                </span>
                <span aria-hidden>·</span>
                <a href="#reviews">{pluralize(listing.reviewCount, 'review')}</a>
              </>
            ) : (
              <span className="font-semibold text-ink">New</span>
            )}
            <span aria-hidden>·</span>
            <span>{where}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <ShareButton />
          <SavePill id={listing.id} />
        </div>
      </div>

      <ListingGallery listingId={listing.id} title={listing.title} photos={listing.photos} />

      <div className="mt-9 flex flex-wrap items-start gap-x-14 gap-y-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col">
          <HostSummary listing={listing} />
          <AboutPlace listing={listing} />
          <Amenities listing={listing} />
          <ListingAvailability
            listingId={listing.id}
            area={listing.area}
            minNights={listing.minNights}
            maxNights={listing.maxNights}
            bookingWindowMonths={listing.bookingWindowMonths}
          />
          <BeforeYouBook listing={listing} />
          <ReviewsSummary listing={listing} />
          <section aria-labelledby="location-title" className="pt-7">
            <h2 id="location-title" className="m-0 mb-1 text-xl font-semibold">
              Where you’ll be
            </h2>
            <p className="m-0 mb-4 text-muted">{where}. The exact address is shared after your booking is confirmed.</p>
            <div className="relative h-[260px] overflow-hidden rounded-panel bg-map">
              <LocationMap center={listing.location} />
            </div>
          </section>
        </div>

        <aside aria-label="Book this place" className="min-w-0 flex-[1_1_340px] lg:sticky lg:top-6">
          <ReserveCardSlot listing={listing} />
        </aside>
      </div>
    </div>
  );
}
