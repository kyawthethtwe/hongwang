'use client';

import { todayInBangkok, type IsoDate, type PlaceDto } from '@hongwang/shared';
import { MapPin, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Stepper } from '@/components/ui/stepper';
import { formatDay, pluralize } from '@/lib/format';
import { usePlaces } from '@/lib/queries/search';
import { cn } from '@/lib/utils';
import { addMonthsIso } from './dates';
import { RangeCalendar } from './range-calendar';
import type { DateRange } from './range';
import { useMediaQuery } from './use-media-query';

export interface SearchBarValue {
  place: string | null;
  checkIn: IsoDate | null;
  checkOut: IsoDate | null;
  guests: number | null;
}

const fieldLabel = 'text-xs font-semibold text-ink-2';
const fieldBox = 'flex min-w-0 flex-col justify-center gap-0.5 px-5 py-2.5 text-left';

/**
 * Search bar (design A1): Where (place autocomplete), Check in / Check out (range calendar in a
 * popover), Guests (stepper), Search. Edits are local until Search is pressed.
 */
export function SearchBar({
  value,
  placeLabel,
  onSearch,
}: {
  value: SearchBarValue;
  /** Label of the current place, e.g. "Ari, Bangkok". */
  placeLabel: string | null;
  onSearch: (v: SearchBarValue) => void;
}) {
  const [placeText, setPlaceText] = useState(placeLabel ?? '');
  const [place, setPlace] = useState<PlaceDto | null>(null);
  const [range, setRange] = useState<DateRange>({ checkIn: value.checkIn, checkOut: value.checkOut });
  const [guests, setGuests] = useState(value.guests ?? 1);
  const [datesOpen, setDatesOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);

  // Follow URL changes made elsewhere (map, back button, listing calendar).
  useEffect(() => setPlaceText(placeLabel ?? ''), [placeLabel]);
  useEffect(() => setRange({ checkIn: value.checkIn, checkOut: value.checkOut }), [value.checkIn, value.checkOut]);
  useEffect(() => setGuests(value.guests ?? 1), [value.guests]);

  const placeQuery = useDebounced(placeText === placeLabel ? '' : placeText, 150);
  const { data: suggestions = [] } = usePlaces(placeQuery);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let slug: string | null = value.place;
    const text = placeText.trim();
    if (!text) slug = null;
    else if (place && text === place.label) slug = place.slug;
    else if (text !== placeLabel) {
      const first = suggestions[0];
      if (!first) {
        toast.info('We only know Bangkok neighbourhoods for now. Try Ari, Silom or Thong Lo.');
        return;
      }
      slug = first.slug;
      setPlaceText(first.label);
    }
    onSearch({
      place: slug,
      checkIn: range.checkIn && range.checkOut ? range.checkIn : null,
      checkOut: range.checkIn && range.checkOut ? range.checkOut : null,
      guests: guests > 1 ? guests : null,
    });
  }

  return (
    <form
      role="search"
      aria-label="Search rooms"
      onSubmit={submit}
      className="flex max-w-[980px] flex-wrap items-stretch rounded-panel border border-line-strong bg-surface"
    >
      <PlaceField
        text={placeText}
        onTextChange={(t) => {
          setPlaceText(t);
          setPlace(null);
        }}
        suggestions={suggestions}
        onPick={(p) => {
          setPlace(p);
          setPlaceText(p.label);
        }}
      />
      <DatesField range={range} onRange={setRange} open={datesOpen} onOpenChange={setDatesOpen} />
      <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(fieldBox, 'flex-[1_1_120px] cursor-pointer rounded-panel border-0 bg-transparent font-normal')}
          >
            <span className={fieldLabel}>Guests</span>
            <span className="min-h-6 text-ink">{pluralize(guests, 'guest')}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent aria-label="Guests" className="w-72">
          <Stepper label="Guests" value={guests} onChange={setGuests} min={1} max={16} />
          <p className="m-0 mt-2 text-[13px] text-muted">Infants under 2 don’t count.</p>
        </PopoverContent>
      </Popover>
      <div className="flex items-center p-2">
        <Button type="submit" size="lg" className="min-h-12 px-[22px]">
          <Search aria-hidden className="size-[18px]" />
          Search
        </Button>
      </div>
    </form>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function PlaceField({
  text,
  onTextChange,
  suggestions,
  onPick,
}: {
  text: string;
  onTextChange: (t: string) => void;
  suggestions: PlaceDto[];
  onPick: (p: PlaceDto) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const items = suggestions.slice(0, 8);
  const expanded = open && items.length > 0;

  function pick(p: PlaceDto) {
    onPick(p);
    setOpen(false);
  }

  return (
    <div className={cn(fieldBox, 'relative flex-[2_1_220px] border-r border-line')}>
      <label htmlFor={id} className={fieldLabel}>
        Where
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Search Bangkok neighbourhoods"
        value={text}
        onChange={(e) => {
          onTextChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={(e) => {
          e.target.select();
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (!expanded) {
            if (e.key === 'ArrowDown') setOpen(true);
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % items.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a - 1 + items.length) % items.length);
          } else if (e.key === 'Enter') {
            const p = items[active];
            if (p && p.label !== text) {
              e.preventDefault();
              pick(p);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="min-h-6 w-full border-0 bg-transparent p-0 text-[15px] text-ink outline-none focus-visible:outline-none"
      />
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Neighbourhoods"
          className="absolute top-full left-0 z-50 m-0 mt-2 max-h-80 w-full min-w-72 list-none overflow-y-auto rounded-card border border-line bg-surface p-1.5 shadow-float"
          onMouseDown={() => clearTimeout(blurTimer.current)}
        >
          {items.map((p, i) => (
            <li
              key={p.slug}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-3 rounded-[8px] px-3 text-[15px]',
                i === active && 'bg-subtle',
              )}
            >
              <MapPin aria-hidden className="size-4 shrink-0 text-muted" />
              {p.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DatesField({
  range,
  onRange,
  open,
  onOpenChange,
}: {
  range: DateRange;
  onRange: (r: DateRange) => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const wide = useMediaQuery('(min-width: 768px)');
  const today = todayInBangkok();
  const trigger = (label: string, date: IsoDate | null, placeholder: string) => (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => onOpenChange(true)}
      className={cn(fieldBox, 'flex-[1_1_140px] cursor-pointer border-0 border-r border-line bg-transparent font-normal')}
    >
      <span className={fieldLabel}>{label}</span>
      <span className={cn('min-h-6', date ? 'text-ink' : 'text-placeholder')}>{date ? formatDay(date) : placeholder}</span>
    </button>
  );
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div className="flex flex-[2_1_280px]">
          {trigger('Check in', range.checkIn, 'Add date')}
          {trigger('Check out', range.checkOut, 'Add date')}
        </div>
      </PopoverAnchor>
      <PopoverContent aria-label="Choose dates" className="w-[min(680px,calc(100vw-32px))] p-5">
        <RangeCalendar
          value={range}
          onChange={(r) => {
            onRange(r);
            if (r.checkIn && r.checkOut) onOpenChange(false);
          }}
          minDate={today}
          maxDate={addMonthsIso(today, 12)}
          numberOfMonths={wide ? 2 : 1}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <p className="m-0 text-sm text-muted" aria-live="polite">
            {range.checkIn && !range.checkOut ? 'Now pick your check-out date' : range.checkIn && range.checkOut ? `${formatDay(range.checkIn)} – ${formatDay(range.checkOut)}` : 'Pick your check-in date'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onRange({ checkIn: null, checkOut: null })}>
              Clear dates
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
