'use client';

import type { ListingSummaryDto } from '@hongwang/shared';
import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { AttributionControl, Marker, type MapRef, type ViewStateChangeEvent } from 'react-map-gl/maplibre';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/field';
import { formatTHB } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BANGKOK_VIEW, MAP_STYLE_URL, bboxToBounds, boundsToBbox } from './map-config';

export interface SearchMapProps {
  listings: ListingSummaryDto[];
  /** Pin to draw in the brand colour (hovered card or clicked pin). */
  highlightedId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Map box from the URL ("search as I move"). Decides the first view; never re-fitted. */
  bbox: string | null;
  /** The searched place's box: the map fits to it (or to the results) whenever `focusKey` changes. */
  fitBbox: string | null;
  focusKey: string;
  moveSearch: boolean;
  onMoveSearchChange: (on: boolean) => void;
  /** Called with 'w,s,e,n' when the visitor pans/zooms and "Search as I move" is on (or they press "Search this area"). */
  onSearchArea: (bbox: string) => void;
  listingHref: (id: string) => string;
}

/**
 * Results map (design A1): price pins, highlighted pin in brand colour, "Search as I move the map",
 * zoom buttons. Client-only (loaded through next/dynamic with ssr: false).
 */
export function SearchMap({
  listings,
  highlightedId,
  selectedId,
  onSelect,
  bbox,
  fitBbox,
  focusKey,
  moveSearch,
  onMoveSearchChange,
  onSearchArea,
  listingHref,
}: SearchMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [pendingBbox, setPendingBbox] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const initialViewState = useMemo(() => {
    const bounds = bbox ? bboxToBounds(bbox) : null;
    if (bounds) return { bounds, fitBoundsOptions: { padding: 0 } };
    const fit = (fitBbox ? bboxToBounds(fitBbox) : null) ?? boundsOf(listings);
    if (fit) return { bounds: fit, fitBoundsOptions: { padding: 60, maxZoom: 15 } };
    return BANGKOK_VIEW;
    // Only the first render decides the initial view; later changes go through fitBounds below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New search (another place, or the map box was cleared): fit to the place's box or the results.
  // While the URL has a box the visitor chose it by moving the map, so leave the view alone.
  const lastFocus = useRef(focusKey);
  useEffect(() => {
    if (!ready || lastFocus.current === focusKey) return;
    lastFocus.current = focusKey;
    const map = mapRef.current;
    if (!map || bbox) return;
    const bounds = (fitBbox ? bboxToBounds(fitBbox) : null) ?? boundsOf(listings);
    if (bounds) map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 600 });
  }, [focusKey, bbox, fitBbox, listings, ready]);

  function onMoveEnd(e: ViewStateChangeEvent) {
    // Ignore programmatic moves (fitBounds / zoom buttons have no originalEvent).
    if (!e.originalEvent) return;
    const next = boundsToBbox(e.target.getBounds());
    if (moveSearch) onSearchArea(next);
    else setPendingBbox(next);
  }

  const selected = listings.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="relative size-full">
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE_URL}
        initialViewState={initialViewState}
        onLoad={() => setReady(true)}
        onMoveEnd={onMoveEnd}
        onClick={() => onSelect(null)}
        dragRotate={false}
        touchPitch={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <AttributionControl compact position="bottom-right" />
        {listings.map((l) => {
          const on = l.id === highlightedId || l.id === selectedId;
          return (
            <Marker key={l.id} longitude={l.location.lng} latitude={l.location.lat} anchor="center" style={{ zIndex: on ? 3 : 2 }}>
              <button
                type="button"
                aria-label={`${l.title}, ${formatTHB(l.basePrice)} a night`}
                aria-pressed={l.id === selectedId}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(l.id === selectedId ? null : l.id);
                }}
                className={cn(
                  'min-h-10 cursor-pointer rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap shadow-pop transition-colors',
                  on ? 'border-brand bg-brand text-white' : 'border-line-strong bg-surface text-ink hover:border-ink',
                )}
              >
                {formatTHB(l.basePrice)}
              </button>
            </Marker>
          );
        })}
      </Map>

      <label className="absolute top-4 left-4 flex min-h-11 cursor-pointer items-center gap-2 rounded-button bg-surface px-3.5 text-sm font-medium shadow-pop">
        <Checkbox
          checked={moveSearch}
          onChange={(e) => {
            onMoveSearchChange(e.target.checked);
            if (e.target.checked && pendingBbox) {
              onSearchArea(pendingBbox);
              setPendingBbox(null);
            }
          }}
        />
        Search as I move the map
      </label>

      {!moveSearch && pendingBbox && (
        <div className="absolute top-[72px] left-1/2 -translate-x-1/2">
          <Button
            variant="dark"
            shape="pill"
            size="sm"
            className="shadow-float"
            onClick={() => {
              onSearchArea(pendingBbox);
              setPendingBbox(null);
            }}
          >
            Search this area
          </Button>
        </div>
      )}

      <div className="absolute top-4 right-4 flex flex-col overflow-hidden rounded-button bg-surface shadow-pop">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => mapRef.current?.zoomIn()}
          className="size-11 cursor-pointer border-0 border-b border-line bg-surface text-xl text-ink hover:bg-canvas"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => mapRef.current?.zoomOut()}
          className="size-11 cursor-pointer border-0 bg-surface text-xl text-ink hover:bg-canvas"
        >
          −
        </button>
      </div>

      {selected && (
        <Link
          href={listingHref(selected.id)}
          className="absolute right-4 bottom-8 left-4 flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 text-ink no-underline shadow-float hover:text-ink"
        >
          <span className="min-w-0">
            <span className="block truncate font-semibold">{selected.title}</span>
            <span className="block truncate text-sm text-muted">{selected.area}</span>
          </span>
          <span className="shrink-0 font-semibold">{formatTHB(selected.basePrice)}</span>
        </Link>
      )}
    </div>
  );
}

function boundsOf(listings: ListingSummaryDto[]): [[number, number], [number, number]] | null {
  if (listings.length === 0) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const l of listings) {
    w = Math.min(w, l.location.lng);
    e = Math.max(e, l.location.lng);
    s = Math.min(s, l.location.lat);
    n = Math.max(n, l.location.lat);
  }
  const pad = 0.004;
  return [
    [w - pad, s - pad],
    [e + pad, n + pad],
  ];
}
