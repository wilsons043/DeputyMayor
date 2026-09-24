/**
 * Mileage Tracker library: reimbursement rates, distance math, geocoding,
 * driving routes, and CSV export.
 *
 * Geocoding uses OpenStreetMap Nominatim and routing uses the public OSRM
 * demo server. Both are keyless and called from the browser. Both can be
 * overridden with VITE_NOMINATIM_URL and VITE_OSRM_URL for a self-hosted
 * instance. When routing is unavailable the distance falls back to a
 * straight-line estimate with a road factor and is flagged as estimated.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  /** Driving distance in miles for the full sequence of points. */
  miles: number;
  /** Driving time in minutes, when known. */
  durationMinutes: number | null;
  /** Route line as [lat, lng] pairs for drawing on a map. */
  geometry: [number, number][];
  /** True when the distance is a straight-line estimate rather than a driving route. */
  estimated: boolean;
}

export interface MileageRatePeriod {
  start: string; // inclusive ISO date
  end: string; // inclusive ISO date
  ratePerMile: number; // dollars
  label: string;
}

/**
 * IRS standard mileage rates for business use. Source: irs.gov standard
 * mileage rates page. Add a new row when the IRS announces a change.
 */
export const IRS_MILEAGE_RATES: MileageRatePeriod[] = [
  { start: '2023-01-01', end: '2023-12-31', ratePerMile: 0.655, label: 'IRS 2023 rate' },
  { start: '2024-01-01', end: '2024-12-31', ratePerMile: 0.67, label: 'IRS 2024 rate' },
  { start: '2025-01-01', end: '2025-12-31', ratePerMile: 0.7, label: 'IRS 2025 rate' },
  { start: '2026-01-01', end: '2026-06-30', ratePerMile: 0.725, label: 'IRS 2026 rate (Jan 1 to Jun 30)' },
  { start: '2026-07-01', end: '2099-12-31', ratePerMile: 0.76, label: 'IRS 2026 rate (Jul 1 onward)' },
];

/** Settings key: custom rate in dollars per mile. Empty means use the IRS rate. */
export const SETTINGS_KEY_MILEAGE_RATE_OVERRIDE = 'mileageRateOverride';
/** Settings key: name printed on the mileage report. */
export const SETTINGS_KEY_MILEAGE_REPORT_NAME = 'mileageReportName';
/** Settings key: organization printed on the mileage report. */
export const SETTINGS_KEY_MILEAGE_REPORT_ORG = 'mileageReportOrg';

export function irsRateForDate(isoDate: string): MileageRatePeriod {
  const found = IRS_MILEAGE_RATES.find((p) => isoDate >= p.start && isoDate <= p.end);
  if (found) return found;
  // Dates before the table: use the earliest known rate. After: the latest.
  const first = IRS_MILEAGE_RATES[0];
  const last = IRS_MILEAGE_RATES[IRS_MILEAGE_RATES.length - 1];
  return isoDate < first.start ? first : last;
}

/**
 * Picks the rate to apply for a trip date: a custom override when set,
 * otherwise the IRS rate in effect on that date.
 */
export function resolveRate(isoDate: string, override?: string | number | null): { ratePerMile: number; label: string } {
  const parsed = typeof override === 'number' ? override : parseFloat(String(override ?? ''));
  if (!Number.isNaN(parsed) && parsed > 0) {
    return { ratePerMile: parsed, label: 'Custom rate' };
  }
  const period = irsRateForDate(isoDate);
  return { ratePerMile: period.ratePerMile, label: period.label };
}

export function computeReimbursement(miles: number, ratePerMile: number): number {
  return Math.round(miles * ratePerMile * 100) / 100;
}

export function roundMiles(miles: number): number {
  return Math.round(miles * 10) / 10;
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

const EARTH_RADIUS_MILES = 3958.7613;

export function haversineMiles(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/** Straight-line distance with a road factor, used only when routing fails. */
export const ROAD_FACTOR = 1.25;

export function estimateRoadMiles(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMiles(points[i - 1], points[i]);
  }
  return total * ROAD_FACTOR;
}

/** Keeps at most maxPoints evenly spaced points so stored routes stay small. */
export function simplifyGeometry(coords: [number, number][], maxPoints = 400): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const out: [number, number][] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(coords[Math.round(i * step)]);
  }
  return out;
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function formatMiles(miles: number): string {
  return `${roundMiles(miles).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
}

// --- Remote services -----------------------------------------------------

function env(name: string): string | undefined {
  const value = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function nominatimBaseUrl(): string {
  return (env('VITE_NOMINATIM_URL') ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
}

export function osrmBaseUrl(): string {
  return (env('VITE_OSRM_URL') ?? 'https://router.project-osrm.org').replace(/\/$/, '');
}

let lastNominatimCall = 0;

/** Nominatim asks for at most one request per second. */
async function throttleNominatim(): Promise<void> {
  const wait = lastNominatimCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();
}

interface NominatimRow {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
}

export async function geocodeAddress(query: string, fetchImpl: typeof fetch = fetch): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (!q) return [];
  await throttleNominatim();
  const url = `${nominatimBaseUrl()}/search?format=jsonv2&limit=5&countrycodes=us&q=${encodeURIComponent(q)}`;
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Address lookup failed (HTTP ${res.status}). Try again in a moment.`);
  const rows = (await res.json()) as NominatimRow[];
  return rows.map((row) => ({
    name: row.name?.trim() || row.display_name.split(',')[0].trim(),
    displayName: row.display_name,
    lat: parseFloat(row.lat),
    lng: parseFloat(row.lon),
  }));
}

export async function reverseGeocode(point: LatLng, fetchImpl: typeof fetch = fetch): Promise<string> {
  await throttleNominatim();
  const url = `${nominatimBaseUrl()}/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}`;
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
  const row = (await res.json()) as Partial<NominatimRow>;
  return row.display_name ?? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

interface OsrmResponse {
  code: string;
  routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
}

/**
 * Driving route through the given points in order. Falls back to a flagged
 * straight-line estimate if the routing service cannot be reached.
 */
export async function routeDriving(points: LatLng[], fetchImpl: typeof fetch = fetch): Promise<RouteResult> {
  if (points.length < 2) throw new Error('A route needs a starting point and a destination.');
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${osrmBaseUrl()}/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=false`;
  try {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Routing service returned HTTP ${res.status}`);
    const data = (await res.json()) as OsrmResponse;
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route) throw new Error(`Routing service could not find a road route (${data.code})`);
    const geometry = simplifyGeometry(route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]));
    return {
      miles: metersToMiles(route.distance),
      durationMinutes: Math.round(route.duration / 60),
      geometry,
      estimated: false,
    };
  } catch (err) {
    console.warn('[mileage] routing failed, using straight-line estimate:', (err as Error).message);
    return {
      miles: estimateRoadMiles(points),
      durationMinutes: null,
      geometry: points.map((p) => [p.lat, p.lng] as [number, number]),
      estimated: true,
    };
  }
}

// --- CSV -----------------------------------------------------------------

export interface TripCsvRow {
  date: string;
  purpose: string;
  category: string;
  from: string;
  to: string;
  stops: string;
  roundTrip: boolean;
  miles: number;
  ratePerMile: number;
  reimbursement: number;
  estimated: boolean;
  notes: string;
}

function csvCell(value: string | number | boolean): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function tripsToCsv(rows: TripCsvRow[]): string {
  const header = ['Date', 'Purpose', 'Category', 'From', 'To', 'Stops', 'Round trip', 'Miles', 'Rate per mile', 'Reimbursement', 'Estimated', 'Notes'];
  const lines = rows.map((r) =>
    [
      r.date,
      r.purpose,
      r.category,
      r.from,
      r.to,
      r.stops,
      r.roundTrip ? 'Yes' : 'No',
      roundMiles(r.miles).toFixed(1),
      r.ratePerMile.toFixed(3),
      r.reimbursement.toFixed(2),
      r.estimated ? 'Yes' : 'No',
      r.notes,
    ]
      .map(csvCell)
      .join(',')
  );
  return [header.join(','), ...lines].join('\n');
}
