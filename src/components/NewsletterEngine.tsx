import { useState, useCallback, useEffect } from 'react';
import { db, expandRecurringEvents, getSetting, setSetting, type EventRecord } from '@/lib/db';
import {
  MONTHLY_AWARENESS_CAMPAIGNS,
  getAwarenessCampaignsForRange,
  getCityHallHolidaysForRange,
  getAllAwarenessCampaignIds,
  SETTINGS_KEY_SELECTED_CAMPAIGNS,
  type AwarenessCampaign,
} from '@/lib/municipal';

// --- Unified newsletter item types for the merged view ---

type NewsletterItem =
  | { type: 'event'; date: string; title: string; category: string; image: string }
  | { type: 'recurring'; date: string; title: string; category: string; time?: string }
  | { type: 'awareness'; month: number; title: string; description: string; keyThemes?: string; mayorOpportunities?: string }
  | { type: 'holiday'; date: string; title: string; description?: string };

function formatDate(s: string): string {
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString(undefined, { month: 'long' });
}

const MONTH_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function NewsletterEngine() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().slice(0, 10);
  });
  const [items, setItems] = useState<NewsletterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User-selected awareness campaign IDs (empty = none selected; null = "use all" / not yet loaded)
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string> | null>(null);
  const [campaignPickerOpen, setCampaignPickerOpen] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load selected campaign IDs from settings on mount
  useEffect(() => {
    let cancelled = false;
    getSetting(SETTINGS_KEY_SELECTED_CAMPAIGNS)
      .then((raw) => {
        if (cancelled) return;
        if (raw == null || raw === '') {
          setSelectedCampaignIds(new Set(getAllAwarenessCampaignIds()));
          return;
        }
        try {
          const ids = JSON.parse(raw) as string[];
          setSelectedCampaignIds(ids.length ? new Set(ids) : new Set());
        } catch {
          setSelectedCampaignIds(new Set(getAllAwarenessCampaignIds()));
        }
      })
      .finally(() => {
        if (!cancelled) setSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistSelectedCampaigns = useCallback(async (ids: Set<string>) => {
    const arr = Array.from(ids);
    await setSetting(SETTINGS_KEY_SELECTED_CAMPAIGNS, JSON.stringify(arr));
    setSelectedCampaignIds(ids);
  }, []);

  const toggleCampaign = useCallback(
    (id: string) => {
      if (selectedCampaignIds == null) return;
      const next = new Set(selectedCampaignIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistSelectedCampaigns(next);
    },
    [selectedCampaignIds, persistSelectedCampaigns]
  );

  const selectAllCampaigns = useCallback(() => {
    persistSelectedCampaigns(new Set(getAllAwarenessCampaignIds()));
  }, [persistSelectedCampaigns]);

  const deselectAllCampaigns = useCallback(() => {
    persistSelectedCampaigns(new Set());
  }, [persistSelectedCampaigns]);

  const runQuery = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59');
      if (start > end) {
        setError('Start date must be on or before end date.');
        setItems([]);
        return;
      }

      const [events, recurringRecords] = await Promise.all([
        db.events.where('date').between(startDate, endDate, true, true).toArray(),
        db.recurringEvents.toArray(),
      ]);

      const expandedRecurring = expandRecurringEvents(recurringRecords, start, end);
      const campaigns = getAwarenessCampaignsForRange(start, end, selectedCampaignIds ?? undefined);
      const holidays = getCityHallHolidaysForRange(start, end);

      const merged: NewsletterItem[] = [];

      for (const e of events as EventRecord[]) {
        merged.push({
          type: 'event',
          date: e.date,
          title: e.title,
          category: e.category,
          image: e.image,
        });
      }
      for (const r of expandedRecurring) {
        merged.push({
          type: 'recurring',
          date: r.date,
          title: r.title,
          category: r.category,
          time: r.time,
        });
      }
      for (const c of campaigns as AwarenessCampaign[]) {
        merged.push({
          type: 'awareness',
          month: c.month,
          title: c.title,
          description: c.description,
          keyThemes: c.keyThemes,
          mayorOpportunities: c.mayorOpportunities,
        });
      }
      for (const h of holidays) {
        merged.push({
          type: 'holiday',
          date: h.date,
          title: h.title,
          description: h.description,
        });
      }

      merged.sort((a, b) => {
        const dateA = 'date' in a ? a.date : `${('month' in a ? a.month : 0).toString().padStart(2, '0')}-01`;
        const dateB = 'date' in b ? b.date : `${('month' in b ? b.month : 0).toString().padStart(2, '0')}-01`;
        const cmp = dateA.localeCompare(dateB);
        if (cmp !== 0) return cmp;
        return a.title.localeCompare(b.title);
      });

      setItems(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load newsletter data.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedCampaignIds]);

  const campaignsByMonth = MONTH_ORDER.map((month) => ({
    month,
    name: getMonthName(month),
    campaigns: MONTHLY_AWARENESS_CAMPAIGNS.filter((c) => c.month === month),
  })).filter((g) => g.campaigns.length > 0);

  return (
    <section className="newsletter-engine" style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6 }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: 6 }}
          />
        </label>
        <button
          type="button"
          onClick={runQuery}
          disabled={loading}
          style={{
            padding: '0.5rem 1rem',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontWeight: 500,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Loading…' : 'Build newsletter'}
        </button>
      </div>

      {/* Awareness campaigns to include (optional, user-selectable) */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setCampaignPickerOpen((o) => !o)}
          style={{
            padding: '0.5rem 0',
            background: 'none',
            border: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#374151',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {campaignPickerOpen ? '▼' : '▶'} Community awareness campaigns to include
          {settingsLoaded && selectedCampaignIds != null && (
            <span style={{ fontWeight: 400, color: '#6b7280' }}>
              ({selectedCampaignIds.size} of {getAllAwarenessCampaignIds().length} selected)
            </span>
          )}
        </button>
        {campaignPickerOpen && settingsLoaded && selectedCampaignIds != null && (
          <div
            style={{
              marginTop: '0.5rem',
              padding: '1rem',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              maxHeight: 320,
              overflowY: 'auto',
            }}
          >
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              Choose which awareness campaigns to include in your newsletter. Great for proclamations, social media, and
              community messaging.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                onClick={selectAllCampaigns}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8125rem',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={deselectAllCampaigns}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8125rem',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Deselect all
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {campaignsByMonth.map(({ month, name, campaigns }) => (
                <div key={month}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                    {name}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                    {campaigns.map((c) => (
                      <label
                        key={c.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCampaignIds.has(c.id)}
                          onChange={() => toggleCampaign(c.id)}
                        />
                        {c.title}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: '#b91c1c', marginBottom: '1rem' }} role="alert">
          {error}
        </p>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', minHeight: 200 }}>
        <h2 style={{ fontSize: '1.125rem', marginTop: 0, marginBottom: '1rem' }}>Merged timeline</h2>
        {items.length === 0 && !loading && (
          <p style={{ color: '#6b7280' }}>
            Select a date range and click “Build newsletter” to see events, recurring meetings, awareness campaigns, and
            City Hall holidays.
          </p>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((item, i) => (
            <li
              key={`${item.type}-${i}-${'date' in item ? item.date : ''}-${'month' in item ? item.month : ''}-${item.title}`}
              style={{
                padding: '0.75rem',
                borderBottom: i < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: '#6b7280',
                  fontWeight: 600,
                }}
              >
                {item.type}
              </span>
              {item.type === 'event' && (
                <>
                  <strong>{item.title}</strong>
                  <span style={{ color: '#6b7280' }}>{formatDate(item.date)} · {item.category}</span>
                  {item.image && (
                    <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Image: {item.image}</span>
                  )}
                </>
              )}
              {item.type === 'recurring' && (
                <>
                  <strong>{item.title}</strong>
                  <span style={{ color: '#6b7280' }}>
                    {formatDate(item.date)}
                    {item.time ? ` · ${item.time}` : ''} · {item.category}
                  </span>
                </>
              )}
              {item.type === 'awareness' && (
                <>
                  <strong>{item.title}</strong>
                  <span style={{ color: '#6b7280' }}>{getMonthName(item.month)}</span>
                  <span style={{ fontSize: '0.875rem' }}>{item.description}</span>
                  {item.mayorOpportunities && (
                    <span style={{ fontSize: '0.8125rem', color: '#6b7280', fontStyle: 'italic' }}>
                      Mayor opportunities: {item.mayorOpportunities}
                    </span>
                  )}
                </>
              )}
              {item.type === 'holiday' && (
                <>
                  <strong>{item.title}</strong>
                  <span style={{ color: '#6b7280' }}>{formatDate(item.date)}</span>
                  {item.description && (
                    <span style={{ fontSize: '0.875rem' }}>{item.description}</span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
