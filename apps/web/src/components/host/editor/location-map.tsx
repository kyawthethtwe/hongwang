'use client';

import type { LatLng } from '@hongwang/shared';
import 'maplibre-gl/dist/maplibre-gl.css';
import Map, { Marker, NavigationControl } from 'react-map-gl/maplibre';

/** Central Bangkok, used until the host places the pin. */
export const BANGKOK: LatLng = { lat: 13.7563, lng: 100.5018 };

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/positron';

/**
 * MapLibre map with a draggable pin for the exact front door (design C4 Location).
 * Client-only: load it with next/dynamic and ssr: false.
 */
export default function LocationMap({ value, onChange }: { value: LatLng | null; onChange: (v: LatLng) => void }) {
  const pin = value ?? BANGKOK;
  return (
    <Map
      initialViewState={{ latitude: pin.lat, longitude: pin.lng, zoom: value ? 16 : 12 }}
      mapStyle={STYLE_URL}
      style={{ width: '100%', height: '100%' }}
      onClick={(e) => onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
      cooperativeGestures
      attributionControl={{ compact: true }}
    >
      <NavigationControl position="bottom-right" showCompass={false} />
      <Marker
        latitude={pin.lat}
        longitude={pin.lng}
        anchor="bottom"
        draggable
        onDragEnd={(e) => onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
      >
        <span
          aria-hidden
          className="block size-6 -rotate-45 rounded-[999px_999px_999px_0] border-[3px] border-surface bg-brand shadow-pop"
        />
      </Marker>
    </Map>
  );
}
