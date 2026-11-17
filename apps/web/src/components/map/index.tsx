'use client';

import dynamic from 'next/dynamic';

/** MapLibre needs `window`, so the maps load client-only. */
function MapLoading() {
  return (
    <div className="flex size-full animate-pulse items-center justify-center bg-map text-sm text-muted" role="status">
      Loading map…
    </div>
  );
}

export const SearchMap = dynamic(() => import('./search-map').then((m) => m.SearchMap), {
  ssr: false,
  loading: MapLoading,
});

export const LocationMap = dynamic(() => import('./location-map').then((m) => m.LocationMap), {
  ssr: false,
  loading: MapLoading,
});
