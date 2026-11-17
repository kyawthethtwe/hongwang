'use client';

import type { SavedListingDto } from '@hongwang/shared';
import Link from 'next/link';
import { useQueryStates } from 'nuqs';
import { toast } from 'sonner';
import { stayOf, stayParsers } from '@/components/search/search-params';
import { Button } from '@/components/ui/button';
import { Banner, EmptyState } from '@/components/ui/feedback';
import { PageTitle } from '@/components/ui/surfaces';
import { useSession } from '@/lib/auth/session';
import { formatStayShort, pluralize } from '@/lib/format';
import { loginHref, useSavedListings, useToggleSaved } from '@/lib/queries/saved';
import { cn } from '@/lib/utils';
import { ListingCard, ListingCardSkeleton } from './listing-card';
import { HeartIcon } from './save-button';

const grid = 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-x-5 gap-y-7';

/** Saved rooms grid with remove + Undo (design B5). Prices are for the dates in the URL, if any. */
export function SavedRooms() {
  const { user, isLoading: sessionLoading } = useSession();
  const [range] = useQueryStates(stayParsers);
  const stay = stayOf(range);
  const dates = stay ? { checkIn: stay.checkIn, checkOut: stay.checkOut } : {};
  const query = useSavedListings(dates, !!user);
  const { toggle } = useToggleSaved();
  const items = query.data ?? [];
  const roomQuery = stay ? `?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}${range.guests ? `&guests=${range.guests}` : ''}` : '';

  function remove(item: SavedListingDto, index: number) {
    toggle({ id: item.id, saved: false });
    toast('Removed from saved', {
      description: item.title,
      action: { label: 'Undo', onClick: () => toggle({ id: item.id, saved: true, restore: { item, index } }) },
    });
  }

  const sub = [
    query.data ? pluralize(items.length, 'room') : null,
    stay ? `Prices shown for ${formatStayShort(stay.checkIn, stay.checkOut)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  let body: React.ReactNode;
  if (!sessionLoading && !user) {
    body = (
      <EmptyState
        icon={<HeartIcon filled={false} size={32} />}
        title="Sign in to see your saved rooms"
        action={
          <Button asChild size="lg">
            <Link href={loginHref('/saved')}>Sign in</Link>
          </Button>
        }
      >
        Tap the heart on any room to keep it here.
      </EmptyState>
    );
  } else if (sessionLoading || query.isPending) {
    body = (
      <div className={grid} role="status" aria-label="Loading saved rooms">
        {Array.from({ length: 3 }, (_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    );
  } else if (query.isError) {
    body = (
      <Banner
        tone="danger"
        title="We couldn’t load your saved rooms."
        action={
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (items.length === 0) {
    body = (
      <EmptyState
        icon={<HeartIcon filled={false} size={32} />}
        title="Nothing saved yet"
        action={
          <Button asChild size="lg" className="mt-1.5">
            <Link href="/">Explore rooms</Link>
          </Button>
        }
      >
        Tap the heart on any room to keep it here.
      </EmptyState>
    );
  } else {
    body = (
      <div className={grid}>
        {items.map((item, i) => (
          <ListingCard
            key={item.id}
            listing={item}
            href={`/rooms/${item.id}${roomQuery}`}
            nights={stay?.nights ?? null}
            action={
              <button
                type="button"
                aria-label={`Remove ${item.title} from saved`}
                onClick={() => remove(item, i)}
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border-0 bg-surface shadow-pop"
              >
                <HeartIcon filled />
              </button>
            }
            footer={
              item.available !== null && stay ? (
                <p className={cn('m-0 text-sm font-medium', item.available ? 'text-brand-hover' : 'text-muted')}>
                  {item.available ? 'Available for your dates' : `Booked for ${formatStayShort(stay.checkIn, stay.checkOut)}`}
                </p>
              ) : null
            }
          />
        ))}
      </div>
    );
  }

  return (
    <main className="mx-auto box-border flex max-w-[1200px] flex-col gap-6 px-4 pt-8 pb-14 sm:px-10">
      <div>
        <PageTitle>Saved</PageTitle>
        {sub && <p className="m-0 mt-1 text-muted">{sub}</p>}
      </div>
      {body}
    </main>
  );
}
