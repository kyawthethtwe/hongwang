'use client';

import {
  ERROR_CODES,
  nightsBetween,
  todayInBangkok,
  type IsoDate,
  type ListingDetailDto,
  type QuoteInput,
  type QuoteReason,
} from '@hongwang/shared';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { addMonthsIso, monthStartIso } from '@/components/search/dates';
import { fromIso, RangeCalendar, toIso } from '@/components/search/range-calendar';
import { stayParsers } from '@/components/search/search-params';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/feedback';
import { Label, Textarea } from '@/components/ui/field';
import { Dialog } from '@/components/ui/overlays';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ApiError, errorMessage } from '@/lib/api/client';
import { loginHref } from '@/lib/auth/next-path';
import { useSession } from '@/lib/auth/session';
import { formatDay, formatTHB, pluralize } from '@/lib/format';
import { useCreateBooking, useStayQuote } from '@/lib/queries/bookings';
import { useAvailability } from '@/lib/queries/listings';
import { cn } from '@/lib/utils';
import { reasonMessage } from './booking-format';
import { PriceLines } from './price-lines';
import { useDebounced } from './use-now';

export interface ReserveCardProps {
  listing: ListingDetailDto;
  /** From the search URL (?checkIn=&checkOut=&guests=), when present. */
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
}

type Range = { checkIn: IsoDate | null; checkOut: IsoDate | null };

const clampGuests = (n: number | undefined, max: number) => Math.min(Math.max(1, n ?? 1), Math.max(1, max));

/**
 * Owner: Bookings & Payments module. The sticky "Reserve" card on the listing page (design A2,
 * right column): dates, guests, live quote (POST /bookings/quote), and Reserve / Request to book
 * (POST /bookings) which sends the guest to /checkout/[bookingId] or shows "request sent".
 * The Listings module renders this component; keep the props stable.
 *
 * Dates and guests start from the props and are written back to ?checkIn&checkOut&guests, so the
 * page's availability calendar and this card always show the same stay. Below `lg`, a compact bar
 * stays at the bottom of the screen while the card is out of view and opens the same form.
 */
export function ReserveCard({ listing, initialCheckIn, initialCheckOut, initialGuests }: ReserveCardProps) {
  const form = useReserveForm(listing, { checkIn: initialCheckIn ?? null, checkOut: initialCheckOut ?? null }, initialGuests);
  const cardRef = useRef<HTMLDivElement>(null);
  const cardInView = useInView(cardRef);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div ref={cardRef} className="flex flex-col gap-4 rounded-sheet border border-line-card bg-surface p-6 shadow-float">
        <ReserveForm form={form} where="card" />
      </div>
      <p className="m-0 mx-1 mt-3.5 text-[13px] text-muted">The price is locked the moment you reserve, even if the host changes it later.</p>

      {!cardInView && !sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 shadow-float lg:hidden">
          <div className="min-w-0">
            <p className="m-0">
              <span className="font-display text-xl font-bold">{formatTHB(listing.basePrice)}</span>{' '}
              <span className="text-ink-2">night</span>
            </p>
            <p className="m-0 truncate text-[13px] text-muted">
              {form.stay ? `${formatDay(form.stay.checkIn)} – ${formatDay(form.stay.checkOut)}` : 'Add dates for the total'}
            </p>
          </div>
          <Button size="lg" onClick={() => setSheetOpen(true)}>
            {listing.instantBook ? 'Reserve' : 'Request to book'}
          </Button>
        </div>
      )}

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen} title="Book this place" description={listing.title}>
        <ReserveForm form={form} where="sheet" />
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------- state

function useReserveForm(listing: ListingDetailDto, initial: Range, initialGuests?: number) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { user, isLoading: sessionLoading } = useSession();
  const [, setUrl] = useQueryStates(stayParsers, { history: 'replace', scroll: false });

  const [range, setRangeState] = useState<Range>(initial);
  const [guests, setGuestsState] = useState(() => clampGuests(initialGuests, listing.maxGuests));
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState<{ id: string } | null>(null);
  /** Which form's date picker is open (the card and the mobile sheet share this state). */
  const [pickerFor, setPickerFor] = useState<FormPlace | null>(null);

  // Props follow the URL (the page calendar writes it): keep the card in sync.
  useEffect(() => {
    setRangeState({ checkIn: initial.checkIn, checkOut: initial.checkOut });
  }, [initial.checkIn, initial.checkOut]);
  useEffect(() => {
    if (initialGuests) setGuestsState(clampGuests(initialGuests, listing.maxGuests));
  }, [initialGuests, listing.maxGuests]);

  const setRange = (r: Range) => {
    setRangeState(r);
    setError(null);
    void setUrl({ checkIn: r.checkIn, checkOut: r.checkOut });
    if (r.checkIn && r.checkOut) setPickerFor(null);
  };
  const setGuests = (n: number) => {
    setGuestsState(n);
    setError(null);
    void setUrl({ guests: n });
  };

  const stay =
    range.checkIn && range.checkOut && range.checkOut > range.checkIn ? { checkIn: range.checkIn, checkOut: range.checkOut } : null;
  const quoteInput = useDebounced<QuoteInput | null>(
    useMemo(() => (stay ? { listingId: listing.id, ...stay, guests } : null), [listing.id, stay?.checkIn, stay?.checkOut, guests]), // eslint-disable-line react-hooks/exhaustive-deps
    250,
  );
  const quote = useStayQuote(stay ? quoteInput : null);
  const create = useCreateBooking();

  const quoteMatches =
    !!quote.data && !!quoteInput && !!stay && quoteInput.checkIn === stay.checkIn && quoteInput.checkOut === stay.checkOut && quoteInput.guests === guests;
  const reasons: QuoteReason[] = quoteMatches ? quote.data!.reasons : [];
  const bookable = quoteMatches && quote.data!.available;

  const currentUrl = () => {
    const qs = new URLSearchParams();
    if (range.checkIn) qs.set('checkIn', range.checkIn);
    if (range.checkOut) qs.set('checkOut', range.checkOut);
    qs.set('guests', String(guests));
    return `${pathname}?${qs.toString()}`;
  };

  async function submit(where: FormPlace) {
    setError(null);
    if (!stay) {
      setPickerFor(where);
      return;
    }
    if (!user) {
      router.push(loginHref(currentUrl()));
      return;
    }
    if (!listing.instantBook && !message.trim()) {
      setError(`Add a short message so ${listing.host.firstName} knows who’s coming.`);
      return;
    }
    try {
      const booking = await create.mutateAsync({
        listingId: listing.id,
        ...stay,
        guests,
        message: message.trim() || undefined,
      });
      if (booking.status === 'payment_hold') router.push(`/checkout/${booking.id}`);
      else setRequestSent({ id: booking.id });
    } catch (err) {
      if (err instanceof ApiError && err.code === ERROR_CODES.datesUnavailable) {
        setError('Someone just booked some of these nights. Please pick different dates.');
        void qc.invalidateQueries({ queryKey: ['listings', 'availability', listing.id] });
        void qc.invalidateQueries({ queryKey: ['bookings', 'quote', listing.id] });
      } else if (err instanceof ApiError && err.status === 401) {
        router.push(loginHref(currentUrl()));
      } else {
        setError(errorMessage(err));
      }
    }
  }

  return {
    listing,
    range,
    setRange,
    stay,
    guests,
    setGuests,
    message,
    setMessage,
    quote,
    quoteMatches,
    reasons,
    bookable,
    error,
    requestSent,
    pickerFor,
    setPickerFor,
    submit,
    submitting: create.isPending,
    signedOut: !sessionLoading && !user,
  };
}

type ReserveFormState = ReturnType<typeof useReserveForm>;
type FormPlace = 'card' | 'sheet';

// ---------------------------------------------------------------- view

function ReserveForm({ form, where }: { form: ReserveFormState; where: FormPlace }) {
  const { listing } = form;
  const id = useId();
  const host = listing.host.firstName;

  if (form.requestSent) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <CheckCircle2 aria-hidden className="size-8 text-brand" />
        <h2 className="m-0 text-xl font-semibold">Request sent</h2>
        <p className="m-0 text-ink-2">
          {host} has 24 hours to respond. You won’t be charged unless they accept, and then you’ll have 15 minutes to pay.
        </p>
        <Button asChild size="lg" block>
          <Link href={`/trips/${form.requestSent.id}`}>View your request</Link>
        </Button>
      </div>
    );
  }

  const nights = form.stay ? nightsBetween(form.stay.checkIn, form.stay.checkOut) : 0;
  const showLines = form.stay && form.quote.data && form.quoteMatches;

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="m-0">
          <span className="font-display text-[28px] font-bold">{formatTHB(listing.basePrice)}</span>{' '}
          <span className="text-ink-2">night</span>
        </p>
        {listing.instantBook && <Badge tone="brand">Instant book</Badge>}
      </div>

      <DatesAndGuests form={form} where={where} />

      {listing.instantBook ? null : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-message`}>Message to {host}</Label>
          <Textarea
            id={`${id}-message`}
            rows={3}
            maxLength={1000}
            value={form.message}
            onChange={(e) => form.setMessage(e.target.value)}
            placeholder={`Say hello and tell ${host} a little about your trip`}
          />
        </div>
      )}

      <Button
        size="xl"
        block
        className="min-h-[52px] text-base"
        loading={form.submitting}
        disabled={!!form.stay && !form.signedOut && !form.bookable}
        onClick={() => void form.submit(where)}
      >
        {!form.stay ? 'Check availability' : listing.instantBook ? 'Reserve' : 'Request to book'}
      </Button>
      <p className="-mt-1 mb-0 text-center text-[13px] text-ink-2">
        {listing.instantBook
          ? 'We hold these dates for 15 minutes while you pay.'
          : `You won’t be charged until ${host} accepts.`}
      </p>

      {form.error && (
        <p role="alert" className="m-0 rounded-field bg-danger-bg px-3.5 py-2.5 text-sm font-medium text-danger-ink">
          {form.error}
        </p>
      )}
      {form.reasons.length > 0 && (
        <ul role="alert" className="m-0 flex list-none flex-col gap-1 rounded-field bg-warn-bg px-3.5 py-2.5 text-sm text-warn-ink">
          {form.reasons.map((r) => (
            <li key={r}>{reasonMessage(r, listing)}</li>
          ))}
        </ul>
      )}

      {showLines ? (
        <PriceLines pricing={form.quote.data!.quote} className={cn(form.quote.isFetching && 'opacity-60')} />
      ) : form.stay ? (
        <p className="m-0 text-sm text-muted" aria-live="polite">
          {form.quote.isError ? errorMessage(form.quote.error, 'Couldn’t price these dates.') : `Pricing ${pluralize(nights, 'night')}…`}
        </p>
      ) : (
        <p className="m-0 text-sm text-muted">Add your dates to see the total, including cleaning and service fees.</p>
      )}
    </>
  );
}

function DatesAndGuests({ form, where }: { form: ReserveFormState; where: FormPlace }) {
  const { listing, range } = form;
  const open = form.pickerFor === where;
  const setOpen = (o: boolean) => form.setPickerFor(o ? where : null);
  const id = useId();
  const today = todayInBangkok();
  const lastDay = addMonthsIso(today, listing.bookingWindowMonths);
  const [month, setMonth] = useState(() => fromIso(monthStartIso(range.checkIn && range.checkIn >= today ? range.checkIn : today)));
  const from = toIso(month);
  const availability = useAvailability(listing.id, from, addMonthsIso(from, 2));
  const unavailable = useMemo(() => new Set<IsoDate>(availability.data?.unavailable ?? []), [availability.data]);

  const field = 'flex min-h-[60px] w-full cursor-pointer flex-col items-start justify-center border-0 bg-transparent px-3.5 py-2.5 text-left';
  const caption = 'text-[11px] font-bold tracking-[0.04em] text-ink-2';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="overflow-hidden rounded-[14px] border border-line-strong">
        <PopoverAnchor asChild>
          <div className="grid grid-cols-2 border-b border-line-strong">
            <button
              type="button"
              className={cn(field, 'border-r border-line-strong')}
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <span className={caption}>CHECK IN</span>
              <span className={range.checkIn ? 'text-ink' : 'text-placeholder'}>{range.checkIn ? formatDay(range.checkIn) : 'Add date'}</span>
            </button>
            <button type="button" className={field} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
              <span className={caption}>CHECK OUT</span>
              <span className={range.checkOut ? 'text-ink' : 'text-placeholder'}>
                {range.checkOut ? formatDay(range.checkOut) : 'Add date'}
              </span>
            </button>
          </div>
        </PopoverAnchor>
        <label htmlFor={`${id}-guests`} className="flex flex-col px-3.5 py-2.5">
          <span className={caption}>GUESTS</span>
          <select
            id={`${id}-guests`}
            value={form.guests}
            onChange={(e) => form.setGuests(Number(e.target.value))}
            className="min-h-6 cursor-pointer border-0 bg-transparent p-0 text-[15px] text-ink focus:outline-none"
          >
            {Array.from({ length: Math.max(1, listing.maxGuests) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {pluralize(n, 'guest')}
              </option>
            ))}
          </select>
        </label>
      </div>
      <PopoverContent align="end" aria-label="Choose your dates" className="w-[min(640px,calc(100vw-32px))]">
        <p className="m-0 mb-2 text-sm text-ink-2">
          {range.checkIn && !range.checkOut
            ? `Check-in ${formatDay(range.checkIn)}. Now pick your check-out date.`
            : listing.minNights > 1
              ? `Minimum stay is ${pluralize(listing.minNights, 'night')}.`
              : 'Pick your check-in date.'}
        </p>
        <RangeCalendar
          value={range}
          onChange={form.setRange}
          unavailable={unavailable}
          minDate={today}
          maxDate={lastDay}
          month={month}
          onMonthChange={setMonth}
        />
        <div className="mt-2 flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => form.setRange({ checkIn: null, checkOut: null })}>
            Clear dates
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** True while `ref` is on screen (the mobile bar hides when the full card is visible). */
function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
}
