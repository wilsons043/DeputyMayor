import Dexie, { type EntityTable } from 'dexie';

// --- Types ---

export interface EventRecord {
  id?: number;
  title: string;
  date: string; // ISO date YYYY-MM-DD
  image: string;
  category: string;
}

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export interface RecurringEventRecord {
  id?: number;
  title: string;
  frequency: RecurrenceFrequency;
  /** For weekly: day of week 0–6 (Sun–Sat). For monthly: day of month 1–31. */
  dayOfWeek?: number;
  dayOfMonth?: number;
  /** Week of month 1–4 for "first Monday" style (optional). */
  weekOfMonth?: number;
  /** Time as HH:mm (optional). */
  time?: string;
  category: string;
  /** Optional end date (ISO) – recurrence stops after this. */
  endDate?: string;
}

export interface SettingsRecord {
  id?: number;
  key: string;
  value: string;
}

/** Result of a field capture sent to Gemini: social posts + slide content. */
export interface GeminiCaptureResponse {
  facebook: string;
  linkedin: string;
  x: string;
  /** Instagram caption (optional for backward compatibility with old captures). */
  instagram?: string;
  slideTitle: string;
  slideBody: string;
}

export interface FieldCaptureRecord {
  id?: number;
  topic: string;
  /** Description of what's actually happening at the site/event. */
  description?: string;
  /** Base64 data URL or raw base64 image data (legacy single photo). */
  imageBase64?: string;
  /** Up to 10 photos; used when multiple are uploaded. */
  imageBase64s?: string[];
  /** JSON string of GeminiCaptureResponse. */
  geminiResponse: string;
  createdAt: number;
}

// --- Database ---

export class DeputyMayorDB extends Dexie {
  events!: EntityTable<EventRecord, 'id'>;
  recurringEvents!: EntityTable<RecurringEventRecord, 'id'>;
  settings!: EntityTable<SettingsRecord, 'id'>;
  fieldCaptures!: EntityTable<FieldCaptureRecord, 'id'>;

  constructor() {
    super('DeputyMayor2');
    this.version(1).stores({
      events: '++id, date, category',
      recurringEvents: '++id, frequency, category',
      settings: '++id, &key',
    });
    this.version(2).stores({
      events: '++id, date, category',
      recurringEvents: '++id, frequency, category',
      settings: '++id, &key',
      fieldCaptures: '++id, createdAt',
    });
  }
}

export const db = new DeputyMayorDB();

// --- Settings helpers (key/value by key name) ---

export async function getSetting(key: string): Promise<string | undefined> {
  const row = await db.settings.where('key').equals(key).first();
  return row?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.settings.where('key').equals(key).first();
  if (existing && existing.id != null) {
    await db.settings.update(existing.id, { value });
  } else {
    await db.settings.add({ key, value });
  }
}

// --- Helpers: expand recurring events into dates in range ---

export interface ExpandedRecurringEvent {
  date: string;
  title: string;
  category: string;
  time?: string;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Expands recurring events into concrete dates within [startDate, endDate].
 * Respects endDate on each recurring event when set.
 */
export function expandRecurringEvents(
  recurring: RecurringEventRecord[],
  startDate: Date,
  endDate: Date
): ExpandedRecurringEvent[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  const result: ExpandedRecurringEvent[] = [];

  for (const rec of recurring) {
    const recEnd = rec.endDate ? new Date(rec.endDate) : null;
    const rangeEnd = recEnd && recEnd < end ? recEnd : end;

    if (rangeEnd < start) continue;

    switch (rec.frequency) {
      case 'daily': {
        const cur = new Date(start);
        while (cur <= rangeEnd) {
          result.push({
            date: toDateOnly(cur),
            title: rec.title,
            category: rec.category,
            time: rec.time,
          });
          cur.setDate(cur.getDate() + 1);
        }
        break;
      }
      case 'weekly': {
        const dow = rec.dayOfWeek ?? start.getDay();
        const cur = new Date(start);
        while (cur.getDay() !== dow) cur.setDate(cur.getDate() + 1);
        while (cur <= rangeEnd) {
          result.push({
            date: toDateOnly(cur),
            title: rec.title,
            category: rec.category,
            time: rec.time,
          });
          cur.setDate(cur.getDate() + 7);
        }
        break;
      }
      case 'biweekly': {
        const dow = rec.dayOfWeek ?? start.getDay();
        const cur = new Date(start);
        while (cur.getDay() !== dow) cur.setDate(cur.getDate() + 1);
        while (cur <= rangeEnd) {
          result.push({
            date: toDateOnly(cur),
            title: rec.title,
            category: rec.category,
            time: rec.time,
          });
          cur.setDate(cur.getDate() + 14);
        }
        break;
      }
      case 'monthly': {
        const dom = rec.dayOfMonth ?? start.getDate();
        const cur = new Date(start.getFullYear(), start.getMonth(), Math.min(dom, 28));
        if (cur < start) cur.setMonth(cur.getMonth() + 1);
        const maxDom = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
        while (cur <= rangeEnd) {
          const actualDom = Math.min(dom, maxDom(cur.getFullYear(), cur.getMonth()));
          cur.setDate(actualDom);
          if (cur >= start && cur <= rangeEnd) {
            result.push({
              date: toDateOnly(cur),
              title: rec.title,
              category: rec.category,
              time: rec.time,
            });
          }
          cur.setMonth(cur.getMonth() + 1);
          cur.setDate(Math.min(dom, maxDom(cur.getFullYear(), cur.getMonth())));
        }
        break;
      }
      case 'quarterly': {
        const dom = rec.dayOfMonth ?? 1;
        const cur = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, dom);
        if (cur < start) cur.setMonth(cur.getMonth() + 3);
        const maxDom = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
        while (cur <= rangeEnd) {
          const actualDom = Math.min(dom, maxDom(cur.getFullYear(), cur.getMonth()));
          cur.setDate(actualDom);
          if (cur >= start && cur <= rangeEnd) {
            result.push({
              date: toDateOnly(cur),
              title: rec.title,
              category: rec.category,
              time: rec.time,
            });
          }
          cur.setMonth(cur.getMonth() + 3);
          cur.setDate(Math.min(dom, maxDom(cur.getFullYear(), cur.getMonth())));
        }
        break;
      }
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}
