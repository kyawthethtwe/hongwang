'use client';

import { SEARCH_SORTS, type Amenity, type RoomType, type SearchSort } from '@hongwang/shared';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Chip } from '@/components/ui/surfaces';
import type { SearchState } from './search-params';

export const SORT_LABELS: Record<SearchSort, string> = {
  recommended: 'Recommended',
  price_asc: 'Price: low to high',
  nearest_transit: 'Closest to BTS/MRT',
  top_rated: 'Top rated',
};

type Patch = Partial<Pick<SearchState, 'minPrice' | 'maxPrice' | 'roomTypes' | 'amenities' | 'instantBook' | 'nearTransit' | 'petsAllowed' | 'sort'>>;

const baht = (n: number) => `฿${n.toLocaleString('en-US')}`;

/** Heading, count line, sort and filter chips (design A1). */
export function SearchToolbar({
  heading,
  summary,
  state,
  onChange,
}: {
  heading: string;
  summary: React.ReactNode;
  state: SearchState;
  onChange: (patch: Patch) => void;
}) {
  const sortId = useId();
  const toggleIn = <T extends string>(list: T[] | null, v: T): T[] | null => {
    const cur = list ?? [];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    return next.length ? next : null;
  };
  const roomType = (t: RoomType) => ({
    pressed: !!state.roomTypes?.includes(t),
    onClick: () => onChange({ roomTypes: toggleIn(state.roomTypes, t) }),
  });
  const amenity = (a: Amenity) => ({
    pressed: !!state.amenities?.includes(a),
    onClick: () => onChange({ amenities: toggleIn(state.amenities, a) }),
  });
  const flag = (k: 'instantBook' | 'nearTransit' | 'petsAllowed') => ({
    pressed: !!state[k],
    onClick: () => onChange({ [k]: state[k] ? null : true }),
  });

  return (
    <section aria-label="Filters" className="flex flex-col gap-3.5 px-4 pt-6 pb-2 sm:px-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 font-display text-[30px] leading-[1.2] font-bold tracking-[-0.02em]">{heading}</h1>
          <p className="m-0 text-muted" aria-live="polite">
            {summary}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-2">
          <Label htmlFor={sortId} className="font-normal text-ink-2">
            Sort by
          </Label>
          <Select
            id={sortId}
            value={state.sort ?? 'recommended'}
            onChange={(e) => onChange({ sort: e.target.value === 'recommended' ? null : (e.target.value as SearchSort) })}
            className="min-h-11 w-auto"
          >
            {SEARCH_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <PriceChip min={state.minPrice} max={state.maxPrice} onApply={(minPrice, maxPrice) => onChange({ minPrice, maxPrice })} />
        <Chip {...roomType('private_room')}>Private room</Chip>
        <Chip {...roomType('entire_place')}>Entire place</Chip>
        <Chip {...flag('nearTransit')}>Near BTS/MRT</Chip>
        <Chip {...amenity('air_conditioning')}>Air-con</Chip>
        <Chip {...flag('instantBook')}>Instant book</Chip>
        <Chip {...flag('petsAllowed')}>Pets allowed</Chip>
      </div>
    </section>
  );
}

function PriceChip({
  min,
  max,
  onApply,
}: {
  min: number | null;
  max: number | null;
  onApply: (min: number | null, max: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [lo, setLo] = useState(min ? String(min) : '');
  const [hi, setHi] = useState(max ? String(max) : '');
  const minId = useId();
  const maxId = useId();
  useEffect(() => {
    if (open) {
      setLo(min ? String(min) : '');
      setHi(max ? String(max) : '');
    }
  }, [open, min, max]);

  const label = min && max ? `${baht(min)} – ${baht(max)}` : min ? `From ${baht(min)}` : max ? `Up to ${baht(max)}` : 'Price';
  const parse = (s: string) => {
    const n = Number.parseInt(s.replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const loN = parse(lo);
  const hiN = parse(hi);
  const invalid = loN !== null && hiN !== null && loN > hiN;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Chip pressed={!!(min || max)} aria-haspopup="dialog">
          {label}
        </Chip>
      </PopoverTrigger>
      <PopoverContent aria-label="Price per night" className="w-80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            onApply(loN, hiN);
            setOpen(false);
          }}
          className="flex flex-col gap-3"
        >
          <p className="m-0 font-semibold">Price per night</p>
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={minId}>Minimum (฿)</Label>
              <Input id={minId} inputMode="numeric" placeholder="No min" value={lo} onChange={(e) => setLo(e.target.value)} />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor={maxId}>Maximum (฿)</Label>
              <Input
                id={maxId}
                inputMode="numeric"
                placeholder="No max"
                value={hi}
                aria-invalid={invalid || undefined}
                onChange={(e) => setHi(e.target.value)}
              />
            </div>
          </div>
          {invalid && (
            <p role="alert" className="m-0 text-[13px] font-medium text-danger-ink">
              The maximum must be above the minimum.
            </p>
          )}
          <p className="m-0 text-[13px] text-muted">Before cleaning and service fees.</p>
          <div className="flex justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onApply(null, null);
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button type="submit" size="sm" disabled={invalid}>
              Show rooms
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
