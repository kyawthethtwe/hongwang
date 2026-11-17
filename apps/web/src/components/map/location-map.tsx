'use client';

import type { LatLng } from '@hongwang/shared';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMemo, useRef, useState } from 'react';
import Map, { AttributionControl, Layer, Marker, Source, type MapRef } from 'react-map-gl/maplibre';
import { MAP_STYLE_URL, tokenColor } from './map-config';

/** Radius of the "approximate area" circle: covers the 150-350 m offset of the public pin. */
const RADIUS_M = 450;

function circle(center: LatLng, radiusM: number, steps = 64) {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [coords] } };
}

/** "Where you'll be" (design A2): an approximate circle around the public pin, never the door. */
export function LocationMap({ center }: { center: LatLng }) {
  const mapRef = useRef<MapRef>(null);
  const data = useMemo(() => circle(center, RADIUS_M), [center]);
  const [brand] = useState(() => tokenColor('--color-brand', 'teal'));
  return (
    <div className="relative size-full">
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE_URL}
        initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 14.3 }}
        scrollZoom={false}
        dragRotate={false}
        touchPitch={false}
        attributionControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <AttributionControl compact position="bottom-right" />
        <Source id="approx-area" type="geojson" data={data}>
          <Layer id="approx-area-fill" type="fill" paint={{ 'fill-color': brand, 'fill-opacity': 0.16 }} />
          <Layer id="approx-area-line" type="line" paint={{ 'line-color': brand, 'line-opacity': 0.5, 'line-width': 2 }} />
        </Source>
        <Marker longitude={center.lng} latitude={center.lat} anchor="center">
          <span className="rounded-full bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink shadow-pop">Approximate area</span>
        </Marker>
      </Map>
      <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-button bg-surface shadow-pop">
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
    </div>
  );
}
