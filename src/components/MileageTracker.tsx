import { Fragment, useState, useEffect, useCallback, useMemo } from 'react';
import {
  db,
  getSetting,
  setSetting,
  type PlaceRecord,
  type TripRecord,
  type TripStop,
  type TripTemplateRecord,
} from '@/lib/db';
import {
  computeReimbursement,
  formatMiles,
  formatMoney,
  formatRate,
  geocodeAddress,
  irsRateForDate,
  irsTableCoverageEnd,
  resolveRate,
  IRS_MILEAGE_RATES,
  IRS_RATES_URL,
  IRS_RATES_VERIFIED_ON,
  reverseGeocode,
  roundMiles,
  routeDriving,
  tripsToCsv,
  SETTINGS_KEY_MILEAGE_RATE_OVERRIDE,
  SETTINGS_KEY_MILEAGE_REPORT_NAME,
  SETTINGS_KEY_MILEAGE_REPORT_ORG,
  type GeocodeResult,
  type RouteResult,
} from '@/lib/mileage';
import { getStoredAccessToken, getOrCreateDeputyMayorFolder, uploadToDrive } from '@/lib/drive';
import { RouteMap, type RouteMapMarker, type RouteMapPath } from './RouteMap';

const SETTINGS_KEY_HOME_BASE = 'mileageHomeBase';

const CATEGORIES = [
  'Council business',
  'Meeting',
  'Conference or training',
  'Site visit',
  'Constituent services',
  'Ceremony or event',
  'Other',
];

type Tab = 'log' | 'history' | 'library' | 'report';

const TABS: { id: Tab; label: string }[] = [
  { id: 'log', label: 'Log a trip' },
  { id: 'history', label: 'Trip log' },
  { id: 'library', label: 'Places, routes and settings' },
  { id: 'report', label: 'Printable report' },
];

function todayIso(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function monthBounds(): { start: string; end: string } {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const iso = (x: Date) => new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function formatDate(s: string): string {
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function tripMarkers(trip: Pick<TripRecord, 'origin' | 'destination' | 'waypoints'>): RouteMapMarker[] {
  return [
    { lat: trip.origin.lat, lng: trip.origin.lng, label: `Start: ${trip.origin.name}`, kind: 'start' },
    ...trip.waypoints.map((w) => ({ lat: w.lat, lng: w.lng, label: `Stop: ${w.name}`, kind: 'stop' as const })),
    { lat: trip.destination.lat, lng: trip.destination.lng, label: `End: ${trip.destination.name}`, kind: 'end' },
  ];
}

function stopLine(trip: Pick<TripRecord, 'origin' | 'destination' | 'waypoints'>): string {
  return [trip.origin.name, ...trip.waypoints.map((w) => w.name), trip.destination.name].join(' to ');
}

function downloadText(fileName: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Shared inline styles (matches the rest of the suite) ---

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '1rem',
};
const input: React.CSSProperties = { padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6, fontSize: '0.9375rem' };
const labelCol: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.25rem' };
const labelText: React.CSSProperties = { fontSize: '0.875rem', fontWeight: 500 };
const primaryBtn: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontWeight: 500,
  cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  background: '#e5e7eb',
  color: '#111827',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.875rem',
  cursor: 'pointer',
};
const dangerBtn: React.CSSProperties = { ...secondaryBtn, background: '#fee2e2', color: '#991b1b' };
const muted: React.CSSProperties = { color: '#6b7280', fontSize: '0.875rem' };

// --- Location picker ---

interface LocationPickerProps {
  label: string;
  value: TripStop | null;
  onChange: (stop: TripStop | null) => void;
  places: PlaceRecord[];
  onSavePlace: (stop: TripStop) => Promise<void>;
  allowCurrentLocation?: boolean;
}

function LocationPicker({ label, value, onChange, places, onSavePlace, allowCurrentLocation }: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setError(null);
    setResults([]);
    if (!query.trim()) return;
    setBusy(true);
    try {
      const found = await geocodeAddress(query);
      if (!found.length) setError('No matches. Try adding the city and state.');
      setResults(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Address lookup failed.');
    } finally {
      setBusy(false);
    }
  };

  const pickResult = (r: GeocodeResult) => {
    onChange({ name: r.name, address: r.displayName, lat: r.lat, lng: r.lng });
    setResults([]);
    setQuery('');
  };

  const pickPlace = (id: string) => {
    const place = places.find((p) => String(p.id) === id);
    if (place) onChange({ name: place.name, address: place.address, lat: place.lat, lng: place.lng });
  };

  const useCurrentLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError('This browser does not support location.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        let address = `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
        try {
          address = await reverseGeocode(point);
        } catch {
          // Keep the coordinate string.
        }
        onChange({ name: 'Current location', address, ...point });
        setBusy(false);
      },
      (geoErr) => {
        setError(`Could not get your location: ${geoErr.message}`);
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const isSaved = value ? places.some((p) => p.lat === value.lat && p.lng === value.lng) : false;

  return (
    <div style={{ ...card, padding: '0.75rem' }}>
      <div style={{ ...labelText, marginBottom: '0.5rem' }}>{label}</div>
      {value ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ flex: '1 1 240px' }}>
            <strong>{value.name}</strong>
            <span style={{ ...muted, display: 'block' }}>{value.address}</span>
          </span>
          {!isSaved && (
            <button type="button" style={secondaryBtn} onClick={() => onSavePlace(value)}>
              Save as place
            </button>
          )}
          <button type="button" style={secondaryBtn} onClick={() => onChange(null)}>
            Change
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {places.length > 0 && (
            <select style={input} value="" onChange={(e) => pickPlace(e.target.value)} aria-label={`${label}: saved place`}>
              <option value="">Choose a saved place</option>
              {places.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              style={{ ...input, flex: '1 1 220px' }}
              placeholder="Search an address or place name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  search();
                }
              }}
              aria-label={`${label}: address search`}
            />
            <button type="button" style={secondaryBtn} onClick={search} disabled={busy}>
              {busy ? 'Working' : 'Search'}
            </button>
            {allowCurrentLocation && (
              <button type="button" style={secondaryBtn} onClick={useCurrentLocation} disabled={busy}>
                Use my location
              </button>
            )}
          </div>
          {results.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid #e5e7eb', borderRadius: 6 }}>
              {results.map((r, i) => (
                <li key={`${r.lat}-${r.lng}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pickResult(r)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem',
                      background: 'none',
                      border: 'none',
                      borderBottom: i < results.length - 1 ? '1px solid #f3f4f6' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <strong>{r.name}</strong>
                    <span style={{ ...muted, display: 'block' }}>{r.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: 0 }} role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main view ---

export function MileageTracker() {
  const [tab, setTab] = useState<Tab>('log');
  const [places, setPlaces] = useState<PlaceRecord[]>([]);
  const [templates, setTemplates] = useState<TripTemplateRecord[]>([]);
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Settings
  const [rateOverride, setRateOverride] = useState('');
  const [reportName, setReportName] = useState('');
  const [reportOrg, setReportOrg] = useState('');
  const [homeBase, setHomeBase] = useState<TripStop | null>(null);

  // Trip form
  const [date, setDate] = useState(todayIso());
  const [purpose, setPurpose] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [origin, setOrigin] = useState<TripStop | null>(null);
  const [destination, setDestination] = useState<TripStop | null>(null);
  const [waypoints, setWaypoints] = useState<TripStop[]>([]);
  const [pendingStop, setPendingStop] = useState<TripStop | null>(null);
  const [roundTrip, setRoundTrip] = useState(true);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [manualMiles, setManualMiles] = useState('');
  const [notes, setNotes] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Quick log from a saved route
  const [quickTemplateId, setQuickTemplateId] = useState('');
  const [quickDate, setQuickDate] = useState(todayIso());

  // History and report range
  const [{ start: rangeStart, end: rangeEnd }, setRange] = useState(monthBounds());
  const [expandedTripId, setExpandedTripId] = useState<number | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, t, override, name, org, base] = await Promise.all([
        db.places.orderBy('name').toArray(),
        db.tripTemplates.orderBy('name').toArray(),
        getSetting(SETTINGS_KEY_MILEAGE_RATE_OVERRIDE),
        getSetting(SETTINGS_KEY_MILEAGE_REPORT_NAME),
        getSetting(SETTINGS_KEY_MILEAGE_REPORT_ORG),
        getSetting(SETTINGS_KEY_HOME_BASE),
      ]);
      if (cancelled) return;
      setPlaces(p);
      setTemplates(t);
      setRateOverride(override ?? '');
      setReportName(name ?? '');
      setReportOrg(org ?? '');
      if (base) {
        try {
          const parsed = JSON.parse(base) as TripStop;
          setHomeBase(parsed);
          setOrigin((cur) => cur ?? parsed);
        } catch {
          // Ignore a corrupt setting.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    let cancelled = false;
    db.trips
      .where('date')
      .between(rangeStart, rangeEnd, true, true)
      .toArray()
      .then((rows) => {
        if (cancelled) return;
        rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
        setTrips(rows);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, refreshKey]);

  const flash = (msg: string) => {
    setNotice(msg);
    setError(null);
    window.setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 4000);
  };

  const savePlace = useCallback(
    async (stop: TripStop) => {
      const name = window.prompt('Name this place (for example City Hall or Home)', stop.name);
      if (!name?.trim()) return;
      try {
        await db.places.add({ name: name.trim(), address: stop.address, lat: stop.lat, lng: stop.lng, createdAt: Date.now() });
        flash(`Saved ${name.trim()} to your places.`);
        refresh();
      } catch (err) {
        setError(err instanceof Error && err.name === 'ConstraintError' ? 'A place with that name already exists.' : 'Could not save the place.');
      }
    },
    [refresh]
  );

  // Any change to the stops invalidates the computed route.
  const routePoints = useMemo(
    () => (origin && destination ? [origin, ...waypoints, destination] : []),
    [origin, destination, waypoints]
  );
  useEffect(() => {
    setRoute(null);
  }, [routePoints]);

  const calculate = async () => {
    setError(null);
    if (!origin || !destination) {
      setError('Choose a starting point and a destination first.');
      return;
    }
    setCalculating(true);
    try {
      const result = await routeDriving(routePoints);
      setRoute(result);
      setManualMiles('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not calculate the route.');
    } finally {
      setCalculating(false);
    }
  };

  const rate = useMemo(() => resolveRate(date, rateOverride), [date, rateOverride]);
  const manual = parseFloat(manualMiles);
  const hasManual = !Number.isNaN(manual) && manual > 0;
  const oneWayMiles = hasManual ? manual / (roundTrip ? 2 : 1) : route?.miles ?? 0;
  const totalMiles = hasManual ? manual : roundTrip ? oneWayMiles * 2 : oneWayMiles;
  const reimbursement = computeReimbursement(roundMiles(totalMiles), rate.ratePerMile);

  const resetForm = () => {
    setDate(todayIso());
    setPurpose('');
    setCategory(CATEGORIES[0]);
    setOrigin(homeBase);
    setDestination(null);
    setWaypoints([]);
    setPendingStop(null);
    setRoundTrip(true);
    setRoute(null);
    setManualMiles('');
    setNotes('');
    setSaveAsTemplate(false);
    setTemplateName('');
  };

  const saveTrip = async () => {
    setError(null);
    if (!origin || !destination) {
      setError('Choose a starting point and a destination.');
      return;
    }
    if (!purpose.trim()) {
      setError('Enter the purpose of the trip. It prints on the reimbursement report.');
      return;
    }
    if (totalMiles <= 0) {
      setError('Calculate the route or type the miles by hand before saving.');
      return;
    }
    if (saveAsTemplate && !templateName.trim()) {
      setError('Give the saved route a name.');
      return;
    }
    setSaving(true);
    try {
      const geometry = route?.geometry ?? routePoints.map((p) => [p.lat, p.lng] as [number, number]);
      let templateId: number | undefined;
      if (saveAsTemplate) {
        templateId = (await db.tripTemplates.add({
          name: templateName.trim(),
          purpose: purpose.trim(),
          category,
          origin,
          destination,
          waypoints,
          roundTrip,
          oneWayMiles: roundMiles(oneWayMiles),
          geometry,
          estimated: route?.estimated ?? true,
          createdAt: Date.now(),
        })) as number;
      }
      await db.trips.add({
        date,
        purpose: purpose.trim(),
        category,
        origin,
        destination,
        waypoints,
        roundTrip,
        oneWayMiles: roundMiles(oneWayMiles),
        totalMiles: roundMiles(totalMiles),
        ratePerMile: rate.ratePerMile,
        rateLabel: rate.label,
        reimbursement,
        geometry,
        estimated: route?.estimated ?? !hasManual,
        manualMiles: hasManual,
        notes: notes.trim() || undefined,
        templateId,
        createdAt: Date.now(),
      });
      flash(`Trip saved: ${formatMiles(totalMiles)} for ${formatMoney(reimbursement)}.`);
      resetForm();
      refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.name === 'ConstraintError'
          ? 'A saved route with that name already exists. Pick another name.'
          : 'Could not save the trip.'
      );
    } finally {
      setSaving(false);
    }
  };

  const logFromTemplate = async (template: TripTemplateRecord, onDate: string) => {
    setError(null);
    const r = resolveRate(onDate, rateOverride);
    const total = roundMiles(template.oneWayMiles * (template.roundTrip ? 2 : 1));
    await db.trips.add({
      date: onDate,
      purpose: template.purpose,
      category: template.category,
      origin: template.origin,
      destination: template.destination,
      waypoints: template.waypoints,
      roundTrip: template.roundTrip,
      oneWayMiles: template.oneWayMiles,
      totalMiles: total,
      ratePerMile: r.ratePerMile,
      rateLabel: r.label,
      reimbursement: computeReimbursement(total, r.ratePerMile),
      geometry: template.geometry,
      estimated: template.estimated,
      manualMiles: false,
      templateId: template.id,
      createdAt: Date.now(),
    });
    flash(`Logged ${template.name} on ${formatDate(onDate)}.`);
    refresh();
  };

  const repeatTrip = (trip: TripRecord) => {
    setDate(todayIso());
    setPurpose(trip.purpose);
    setCategory(trip.category);
    setOrigin(trip.origin);
    setDestination(trip.destination);
    setWaypoints(trip.waypoints);
    setRoundTrip(trip.roundTrip);
    setNotes(trip.notes ?? '');
    setManualMiles('');
    // Reuse the stored route so no lookup is needed.
    window.setTimeout(
      () =>
        setRoute({
          miles: trip.oneWayMiles,
          durationMinutes: null,
          geometry: trip.geometry,
          estimated: trip.estimated,
        }),
      0
    );
    setTab('log');
    flash('Trip copied into the form. Adjust the date and save.');
  };

  const deleteTrip = async (trip: TripRecord) => {
    if (!window.confirm(`Delete the ${formatDate(trip.date)} trip to ${trip.destination.name}?`)) return;
    await db.trips.delete(trip.id!);
    refresh();
  };

  const deleteTemplate = async (t: TripTemplateRecord) => {
    if (!window.confirm(`Delete the saved route "${t.name}"?`)) return;
    await db.tripTemplates.delete(t.id!);
    refresh();
  };

  const deletePlace = async (p: PlaceRecord) => {
    if (!window.confirm(`Delete the saved place "${p.name}"?`)) return;
    await db.places.delete(p.id!);
    refresh();
  };

  const saveSettings = async () => {
    const parsed = parseFloat(rateOverride);
    if (rateOverride.trim() && (Number.isNaN(parsed) || parsed <= 0)) {
      setError('The custom rate must be a number in dollars per mile, for example 0.725.');
      return;
    }
    await Promise.all([
      setSetting(SETTINGS_KEY_MILEAGE_RATE_OVERRIDE, rateOverride.trim()),
      setSetting(SETTINGS_KEY_MILEAGE_REPORT_NAME, reportName.trim()),
      setSetting(SETTINGS_KEY_MILEAGE_REPORT_ORG, reportOrg.trim()),
    ]);
    flash('Mileage settings saved.');
  };

  const setDefaultOrigin = async (stop: TripStop | null) => {
    await setSetting(SETTINGS_KEY_HOME_BASE, stop ? JSON.stringify(stop) : '');
    setHomeBase(stop);
    flash(stop ? `${stop.name} is now the default starting point.` : 'Default starting point cleared.');
  };

  const totals = useMemo(
    () =>
      trips.reduce(
        (acc, t) => ({ miles: acc.miles + t.totalMiles, money: acc.money + t.reimbursement }),
        { miles: 0, money: 0 }
      ),
    [trips]
  );

  const csvText = () =>
    tripsToCsv(
      [...trips].reverse().map((t) => ({
        date: t.date,
        purpose: t.purpose,
        category: t.category,
        from: t.origin.name,
        to: t.destination.name,
        stops: t.waypoints.map((w) => w.name).join('; '),
        roundTrip: t.roundTrip,
        miles: t.totalMiles,
        ratePerMile: t.ratePerMile,
        reimbursement: t.reimbursement,
        estimated: t.estimated,
        notes: t.notes ?? '',
      }))
    );

  const exportCsv = () => {
    if (!trips.length) {
      setError('No trips in this date range to export.');
      return;
    }
    downloadText(`Mileage_${rangeStart}_to_${rangeEnd}.csv`, csvText(), 'text/csv');
  };

  const saveCsvToDrive = async () => {
    setError(null);
    const token = getStoredAccessToken();
    if (!token) {
      setError('Connect Google Drive in Settings first.');
      return;
    }
    if (!trips.length) {
      setError('No trips in this date range to save.');
      return;
    }
    setDriveBusy(true);
    try {
      const folderId = await getOrCreateDeputyMayorFolder(token);
      await uploadToDrive(token, folderId, `Mileage_${rangeStart}_to_${rangeEnd}.csv`, new Blob([csvText()], { type: 'text/csv' }), 'text/csv');
      flash('Mileage log saved to the Deputy Mayor Assets folder in Google Drive.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save to Google Drive.');
    } finally {
      setDriveBusy(false);
    }
  };

  const formPaths: RouteMapPath[] = route ? [{ geometry: route.geometry }] : [];
  const formMarkers: RouteMapMarker[] = origin && destination ? tripMarkers({ origin, destination, waypoints }) : [];

  const rangeControls = (
    <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
      <label style={labelCol}>
        <span style={labelText}>From</span>
        <input type="date" style={input} value={rangeStart} onChange={(e) => setRange({ start: e.target.value, end: rangeEnd })} />
      </label>
      <label style={labelCol}>
        <span style={labelText}>To</span>
        <input type="date" style={input} value={rangeEnd} onChange={(e) => setRange({ start: rangeStart, end: e.target.value })} />
      </label>
      <button type="button" style={secondaryBtn} onClick={() => setRange(monthBounds())}>
        This month
      </button>
    </div>
  );

  return (
    <section aria-labelledby="mileage-heading" className="mileage-tracker">
      <div className="no-print">
        <h2 id="mileage-heading" style={{ marginTop: 0, marginBottom: '0.25rem', fontSize: '1.25rem' }}>
          Mileage Tracker
        </h2>
        <p style={{ ...muted, marginTop: 0, marginBottom: '1rem' }}>
          Log city travel, let the tracker calculate the miles and reimbursement, and print a report with the map.
        </p>
        <div role="tablist" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              style={{
                ...secondaryBtn,
                background: tab === t.id ? '#1e3a5f' : '#e5e7eb',
                color: tab === t.id ? '#fff' : '#111827',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {notice && (
          <p style={{ background: '#ecfdf5', color: '#065f46', padding: '0.5rem 0.75rem', borderRadius: 6 }} role="status">
            {notice}
          </p>
        )}
        {error && (
          <p style={{ background: '#fef2f2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: 6 }} role="alert">
            {error}
          </p>
        )}
      </div>

      {tab === 'log' && (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveTrip();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
          >
            {templates.length > 0 && (
              <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe' }}>
                <div style={{ ...labelText, marginBottom: '0.5rem' }}>Quick log a saved route</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <select style={{ ...input, flex: '1 1 200px' }} value={quickTemplateId} onChange={(e) => setQuickTemplateId(e.target.value)} aria-label="Saved route">
                    <option value="">Choose a saved route</option>
                    {templates.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.name} ({formatMiles(t.oneWayMiles * (t.roundTrip ? 2 : 1))})
                      </option>
                    ))}
                  </select>
                  <input type="date" style={input} value={quickDate} onChange={(e) => setQuickDate(e.target.value)} aria-label="Date for saved route" />
                  <button
                    type="button"
                    style={primaryBtn}
                    disabled={!quickTemplateId}
                    onClick={() => {
                      const t = templates.find((x) => String(x.id) === quickTemplateId);
                      if (t) logFromTemplate(t, quickDate);
                    }}
                  >
                    Log it
                  </button>
                </div>
                <p style={{ ...muted, margin: '0.5rem 0 0' }}>One click, no lookups. Miles come from the saved route and the rate from the date.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <label style={labelCol}>
                <span style={labelText}>Date</span>
                <input type="date" style={input} value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label style={{ ...labelCol, flex: '1 1 160px' }}>
                <span style={labelText}>Category</span>
                <select style={input} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label style={labelCol}>
              <span style={labelText}>Purpose</span>
              <input
                style={input}
                placeholder="For example: Missouri Municipal League board meeting"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </label>

            <LocationPicker label="Starting point" value={origin} onChange={setOrigin} places={places} onSavePlace={savePlace} allowCurrentLocation />
            {origin && (homeBase?.lat !== origin.lat || homeBase?.lng !== origin.lng) && (
              <button type="button" style={{ ...secondaryBtn, alignSelf: 'flex-start' }} onClick={() => setDefaultOrigin(origin)}>
                Make this my default starting point
              </button>
            )}

            {waypoints.length > 0 && (
              <div style={{ ...card, padding: '0.75rem' }}>
                <div style={{ ...labelText, marginBottom: '0.5rem' }}>Stops along the way</div>
                <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {waypoints.map((w, i) => (
                    <li key={`${w.lat}-${w.lng}-${i}`} style={{ marginBottom: '0.25rem' }}>
                      {w.name}{' '}
                      <button type="button" style={{ ...dangerBtn, padding: '0.1rem 0.5rem' }} onClick={() => setWaypoints(waypoints.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <LocationPicker
              label="Add a stop (optional)"
              value={pendingStop}
              onChange={(stop) => {
                if (stop) {
                  setWaypoints([...waypoints, stop]);
                  setPendingStop(null);
                } else {
                  setPendingStop(null);
                }
              }}
              places={places}
              onSavePlace={savePlace}
            />

            <LocationPicker label="Destination" value={destination} onChange={setDestination} places={places} onSavePlace={savePlace} />

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} />
              Round trip (miles are doubled)
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <button type="button" style={primaryBtn} onClick={calculate} disabled={calculating || !origin || !destination}>
                {calculating ? 'Calculating' : 'Calculate route'}
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={muted}>or type total miles</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  style={{ ...input, width: 110 }}
                  value={manualMiles}
                  onChange={(e) => setManualMiles(e.target.value)}
                  aria-label="Total miles typed by hand"
                />
              </label>
            </div>

            <div style={{ ...card, background: '#f9fafb' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div>
                  <div style={muted}>Miles claimed</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatMiles(totalMiles)}</div>
                  {route && !hasManual && (
                    <div style={muted}>
                      {formatMiles(route.miles)} one way
                      {route.durationMinutes != null ? `, about ${route.durationMinutes} min` : ''}
                      {route.estimated ? ' (straight-line estimate, routing unavailable)' : ''}
                    </div>
                  )}
                </div>
                <div>
                  <div style={muted}>Rate</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatRate(rate.ratePerMile)}/mi</div>
                  <div style={muted}>
                    {rate.label}
                    {rate.source ? ` (${rate.source})` : ''}
                  </div>
                  {rate.stale && (
                    <div style={{ color: '#92400e', fontSize: '0.8125rem', marginTop: '0.25rem' }} role="alert">
                      This date is past the last IRS rate on file ({formatDate(irsTableCoverageEnd())}). The latest known rate is applied.
                      Check{' '}
                      <a href={IRS_RATES_URL} target="_blank" rel="noopener noreferrer">
                        irs.gov
                      </a>{' '}
                      for a newer rate or set a custom rate.
                    </div>
                  )}
                </div>
                <div>
                  <div style={muted}>Reimbursement</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#065f46' }}>{formatMoney(reimbursement)}</div>
                </div>
              </div>
            </div>

            <label style={labelCol}>
              <span style={labelText}>Notes (optional)</span>
              <textarea style={{ ...input, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
              Save this as a route I can log again with one click
            </label>
            {saveAsTemplate && (
              <input
                style={input}
                placeholder="Route name, for example City Hall to Jefferson City"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                aria-label="Saved route name"
              />
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" style={primaryBtn} disabled={saving}>
                {saving ? 'Saving' : 'Save trip'}
              </button>
              <button type="button" style={secondaryBtn} onClick={resetForm}>
                Clear
              </button>
            </div>
          </form>

          <div style={card}>
            <div style={{ ...labelText, marginBottom: '0.5rem' }}>Route map</div>
            <RouteMap paths={formPaths} markers={formMarkers} height={420} />
            <p style={{ ...muted, margin: '0.5rem 0 0' }}>
              Green is the start, orange are stops, red is the destination. The line appears after you calculate the route.
            </p>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div>
          {rangeControls}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1rem' }}>
            <div>
              <div style={muted}>Trips</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{trips.length}</div>
            </div>
            <div>
              <div style={muted}>Miles</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatMiles(totals.miles)}</div>
            </div>
            <div>
              <div style={muted}>Reimbursement</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#065f46' }}>{formatMoney(totals.money)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <button type="button" style={secondaryBtn} onClick={exportCsv}>
              Download CSV
            </button>
            <button type="button" style={secondaryBtn} onClick={saveCsvToDrive} disabled={driveBusy}>
              {driveBusy ? 'Saving' : 'Save CSV to Google Drive'}
            </button>
            <button type="button" style={primaryBtn} onClick={() => setTab('report')}>
              Open printable report
            </button>
          </div>
          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Date</th>
                  <th style={{ padding: '0.5rem' }}>Purpose</th>
                  <th style={{ padding: '0.5rem' }}>Route</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Miles</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '0.5rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {trips.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '1rem', color: '#6b7280' }}>
                      No trips logged in this date range.
                    </td>
                  </tr>
                )}
                {trips.map((t) => (
                  <Fragment key={t.id}>
                    <tr style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>{formatDate(t.date)}</td>
                      <td style={{ padding: '0.5rem' }}>
                        {t.purpose}
                        <div style={muted}>{t.category}</div>
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        {stopLine(t)}
                        <div style={muted}>
                          {t.roundTrip ? 'Round trip' : 'One way'}
                          {t.estimated ? ', estimated' : ''}
                          {t.manualMiles ? ', miles entered by hand' : ''}
                        </div>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatMiles(t.totalMiles)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatRate(t.ratePerMile)}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{formatMoney(t.reimbursement)}</td>
                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button type="button" style={secondaryBtn} onClick={() => setExpandedTripId(expandedTripId === t.id ? null : t.id!)}>
                            {expandedTripId === t.id ? 'Hide map' : 'Map'}
                          </button>
                          <button type="button" style={secondaryBtn} onClick={() => repeatTrip(t)}>
                            Repeat
                          </button>
                          <button type="button" style={dangerBtn} onClick={() => deleteTrip(t)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedTripId === t.id && (
                      <tr>
                        <td colSpan={7} style={{ padding: '0.5rem' }}>
                          <RouteMap paths={[{ geometry: t.geometry }]} markers={tripMarkers(t)} height={300} />
                          {t.notes && <p style={{ ...muted, marginBottom: 0 }}>Notes: {t.notes}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              {trips.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e5e7eb', fontWeight: 700 }}>
                    <td style={{ padding: '0.5rem' }} colSpan={3}>
                      Total
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMiles(totals.miles)}</td>
                    <td></td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(totals.money)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {tab === 'library' && (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div style={card}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Saved routes</h3>
            <p style={muted}>Routes you can log again with one click from the Log a trip tab.</p>
            {templates.length === 0 && <p style={muted}>None yet. Check "Save this as a route" when you log a trip.</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {templates.map((t) => (
                <li key={t.id} style={{ padding: '0.5rem 0', borderTop: '1px solid #f3f4f6', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ flex: '1 1 200px' }}>
                    <strong>{t.name}</strong>
                    <span style={{ ...muted, display: 'block' }}>
                      {stopLine(t)}, {formatMiles(t.oneWayMiles * (t.roundTrip ? 2 : 1))} {t.roundTrip ? 'round trip' : 'one way'}
                    </span>
                  </span>
                  <button type="button" style={secondaryBtn} onClick={() => logFromTemplate(t, todayIso())}>
                    Log today
                  </button>
                  <button type="button" style={dangerBtn} onClick={() => deleteTemplate(t)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div style={card}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Saved places</h3>
            <p style={muted}>Pick these from the dropdown instead of searching each time.</p>
            {places.length === 0 && <p style={muted}>None yet. Use "Save as place" after choosing a location.</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {places.map((p) => (
                <li key={p.id} style={{ padding: '0.5rem 0', borderTop: '1px solid #f3f4f6', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ flex: '1 1 200px' }}>
                    <strong>{p.name}</strong>
                    <span style={{ ...muted, display: 'block' }}>{p.address}</span>
                  </span>
                  <button type="button" style={secondaryBtn} onClick={() => setDefaultOrigin({ name: p.name, address: p.address, lat: p.lat, lng: p.lng })}>
                    Default start
                  </button>
                  <button type="button" style={dangerBtn} onClick={() => deletePlace(p)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
            {homeBase && (
              <p style={{ ...muted, marginTop: '0.75rem' }}>
                Default starting point: <strong>{homeBase.name}</strong>{' '}
                <button type="button" style={{ ...secondaryBtn, padding: '0.1rem 0.5rem' }} onClick={() => setDefaultOrigin(null)}>
                  Clear
                </button>
              </p>
            )}
          </div>

          <div style={card}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Mileage settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={labelCol}>
                <span style={labelText}>Custom rate (dollars per mile)</span>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  style={input}
                  placeholder={`Leave blank to use the IRS rate (${formatRate(irsRateForDate(todayIso()).ratePerMile)} today)`}
                  value={rateOverride}
                  onChange={(e) => setRateOverride(e.target.value)}
                />
                <span style={muted}>Use this if the city reimburses at its own rate. The IRS rate is applied by trip date otherwise.</span>
              </label>
              <div style={{ ...muted, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
                <div>
                  <strong>IRS rates on file</strong>, checked against{' '}
                  <a href={IRS_RATES_URL} target="_blank" rel="noopener noreferrer">
                    irs.gov
                  </a>{' '}
                  on {formatDate(IRS_RATES_VERIFIED_ON)}:
                </div>
                <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                  {[...IRS_MILEAGE_RATES].reverse().slice(0, 4).map((p) => (
                    <li key={p.start}>
                      {p.label}: {formatRate(p.ratePerMile)} per mile (
                      <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {p.source}
                      </a>
                      )
                    </li>
                  ))}
                </ul>
                {todayIso() > irsTableCoverageEnd() && (
                  <div style={{ color: '#92400e', marginTop: '0.35rem' }} role="alert">
                    Today is past the last rate on file ({formatDate(irsTableCoverageEnd())}). The IRS may have announced a new rate. Check
                    irs.gov and update the rate table or set a custom rate.
                  </div>
                )}
              </div>
              <label style={labelCol}>
                <span style={labelText}>Name on the report</span>
                <input style={input} value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="Sean A. Wilson, Mayor" />
              </label>
              <label style={labelCol}>
                <span style={labelText}>Organization on the report</span>
                <input style={input} value={reportOrg} onChange={(e) => setReportOrg(e.target.value)} placeholder="City of Waynesville, Missouri" />
              </label>
              <button type="button" style={{ ...primaryBtn, alignSelf: 'flex-start' }} onClick={saveSettings}>
                Save settings
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'report' && (
        <div className="mileage-report">
          {rangeControls}
          <div className="no-print" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button type="button" style={primaryBtn} onClick={() => window.print()}>
              Print or save as PDF
            </button>
            <button type="button" style={secondaryBtn} onClick={exportCsv}>
              Download CSV
            </button>
          </div>

          <div className="report-page">
            <header style={{ borderBottom: '2px solid #1e3a5f', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1e3a5f' }}>Mileage Reimbursement Report</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1.5rem', fontSize: '0.9rem' }}>
                {reportOrg && <span>{reportOrg}</span>}
                {reportName && <span>Prepared by {reportName}</span>}
                <span>
                  Period: {formatDate(rangeStart)} to {formatDate(rangeEnd)}
                </span>
                <span>Generated {formatDate(todayIso())}</span>
              </div>
            </header>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '1rem' }}>
              <div>
                <div style={muted}>Trips</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{trips.length}</div>
              </div>
              <div>
                <div style={muted}>Total miles</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatMiles(totals.miles)}</div>
              </div>
              <div>
                <div style={muted}>Total reimbursement</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatMoney(totals.money)}</div>
              </div>
            </div>

            {trips.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <RouteMap
                  paths={trips.map((t, i) => ({ geometry: t.geometry, label: `${formatDate(t.date)}: ${t.purpose}`, color: i % 2 ? '#7c3aed' : '#2563eb' }))}
                  markers={trips.flatMap((t) => tripMarkers(t))}
                  height={360}
                  staticMap
                />
                <div style={{ ...muted, marginTop: '0.25rem' }}>All trips in this period. Map data from OpenStreetMap contributors.</div>
              </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem', border: '1px solid #e5e7eb' }}>Date</th>
                  <th style={{ padding: '0.4rem', border: '1px solid #e5e7eb' }}>Purpose</th>
                  <th style={{ padding: '0.4rem', border: '1px solid #e5e7eb' }}>From</th>
                  <th style={{ padding: '0.4rem', border: '1px solid #e5e7eb' }}>To</th>
                  <th style={{ padding: '0.4rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Miles</th>
                  <th style={{ padding: '0.4rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '0.4rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {trips.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '0.75rem', color: '#6b7280' }}>
                      No trips logged in this period.
                    </td>
                  </tr>
                )}
                {[...trips].reverse().map((t) => (
                  <tr key={t.id}>
                    <td style={{ padding: '0.4rem', border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{formatDate(t.date)}</td>
                    <td style={{ padding: '0.4rem', border: '1px solid #e5e7eb' }}>{t.purpose}</td>
                    <td style={{ padding: '0.4rem', border: '1px solid #e5e7eb' }}>{t.origin.name}</td>
                    <td style={{ padding: '0.4rem', border: '1px solid #e5e7eb' }}>
                      {t.waypoints.length ? `${t.waypoints.map((w) => w.name).join(', ')}, then ` : ''}
                      {t.destination.name}
                      {t.roundTrip ? ' (round trip)' : ''}
                    </td>
                    <td style={{ padding: '0.4rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{roundMiles(t.totalMiles).toFixed(1)}</td>
                    <td style={{ padding: '0.4rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{t.ratePerMile.toFixed(3)}</td>
                    <td style={{ padding: '0.4rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatMoney(t.reimbursement)}</td>
                  </tr>
                ))}
              </tbody>
              {trips.length > 0 && (
                <tfoot>
                  <tr style={{ fontWeight: 700, background: '#f9fafb' }}>
                    <td colSpan={4} style={{ padding: '0.4rem', border: '1px solid #e5e7eb' }}>
                      Total
                    </td>
                    <td style={{ padding: '0.4rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{roundMiles(totals.miles).toFixed(1)}</td>
                    <td style={{ border: '1px solid #e5e7eb' }}></td>
                    <td style={{ padding: '0.4rem', border: '1px solid #e5e7eb', textAlign: 'right' }}>{formatMoney(totals.money)}</td>
                  </tr>
                </tfoot>
              )}
            </table>

            {trips.length > 0 && (
              <div className="report-trip-maps">
                <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Trip maps</h3>
                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                  {[...trips].reverse().map((t) => (
                    <div key={t.id} className="report-trip-card" style={{ ...card, padding: '0.5rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {formatDate(t.date)}: {t.purpose}
                      </div>
                      <div style={{ ...muted, marginBottom: '0.35rem' }}>
                        {stopLine(t)}, {formatMiles(t.totalMiles)} {t.roundTrip ? 'round trip' : 'one way'}, {formatMoney(t.reimbursement)}
                        {t.estimated ? ' (estimated)' : ''}
                      </div>
                      <RouteMap paths={[{ geometry: t.geometry }]} markers={tripMarkers(t)} height={220} staticMap />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="report-signature" style={{ marginTop: '2rem', display: 'flex', gap: '3rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              <div style={{ flex: '1 1 200px', borderTop: '1px solid #111', paddingTop: '0.25rem' }}>Signature of traveler</div>
              <div style={{ flex: '1 1 200px', borderTop: '1px solid #111', paddingTop: '0.25rem' }}>Approved by</div>
              <div style={{ flex: '0 1 120px', borderTop: '1px solid #111', paddingTop: '0.25rem' }}>Date</div>
            </div>
            <p style={{ ...muted, marginTop: '1rem' }}>
              Rates follow the IRS standard mileage rate in effect on each trip date unless a custom rate is set (IRS standard
              mileage rates, irs.gov, checked {formatDate(IRS_RATES_VERIFIED_ON)}
              {trips.some((t) => t.rateLabel === 'Custom rate') ? '; custom rate applied where noted' : ''}). Distances are
              road routes unless marked estimated. Trips marked estimated used a straight-line distance with a road factor
              because the routing service was unavailable.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
