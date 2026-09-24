import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface RouteMapPath {
  geometry: [number, number][];
  color?: string;
  label?: string;
}

export interface RouteMapMarker {
  lat: number;
  lng: number;
  label: string;
  kind?: 'start' | 'end' | 'stop';
}

interface RouteMapProps {
  paths: RouteMapPath[];
  markers?: RouteMapMarker[];
  height?: number;
  /** Turn off zoom and drag, for print layouts. */
  staticMap?: boolean;
  className?: string;
}

const MARKER_COLORS: Record<NonNullable<RouteMapMarker['kind']>, string> = {
  start: '#059669',
  end: '#dc2626',
  stop: '#d97706',
};

/**
 * Leaflet map showing one or more route lines with start, stop, and end markers.
 * Tiles come from OpenStreetMap. Circle markers are used so no icon images
 * need bundling.
 */
export function RouteMap({ paths, markers = [], height = 320, staticMap = false, className }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: !staticMap,
      dragging: !staticMap,
      scrollWheelZoom: !staticMap,
      doubleClickZoom: !staticMap,
      touchZoom: !staticMap,
      boxZoom: !staticMap,
      keyboard: !staticMap,
      attributionControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.setView([37.83, -92.2], 8);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // staticMap only matters at creation time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds = L.latLngBounds([]);

    paths.forEach((path, i) => {
      if (path.geometry.length < 2) return;
      const color = path.color ?? (i === 0 ? '#2563eb' : '#7c3aed');
      const line = L.polyline(path.geometry, { color, weight: 4, opacity: 0.85 });
      if (path.label) line.bindTooltip(path.label, { sticky: true });
      line.addTo(layer);
      bounds.extend(line.getBounds());
    });

    markers.forEach((m) => {
      const color = MARKER_COLORS[m.kind ?? 'stop'];
      L.circleMarker([m.lat, m.lng], { radius: 7, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 })
        .bindTooltip(m.label)
        .addTo(layer);
      bounds.extend([m.lat, m.lng]);
    });

    // Let the container settle before sizing, then frame the routes.
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [paths, markers]);

  useEffect(() => {
    const onBeforePrint = () => mapRef.current?.invalidateSize();
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, []);

  return <div ref={containerRef} className={`route-map ${className ?? ''}`} style={{ height, width: '100%' }} />;
}
