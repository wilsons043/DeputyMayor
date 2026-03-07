# Deputy Mayor 2.0

Local-first, date-aware municipal assistant. Build newsletters from events, recurring meetings, awareness campaigns, and City Hall holidays over a chosen date range.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173 and use the **Newsletter Engine**: pick a start and end date, then click **Build newsletter** to see the merged timeline.

## Structure

- **`src/lib/db.ts`** — Dexie.js (IndexedDB) database:
  - `events` — one-off events (id, title, date, image, category)
  - `recurringEvents` — recurring meetings (frequency: daily/weekly/biweekly/monthly/quarterly, dayOfWeek/dayOfMonth, etc.)
  - `settings` — key/value app settings  
  Includes `expandRecurringEvents()` to turn recurring rules into concrete dates in a range.

- **`src/lib/municipal.ts`** — Municipal intelligence (hardcoded):
  - **Monthly Awareness Campaigns** — title + description per month (e.g. Black History Month, Earth Month)
  - **City Hall Holidays** — observed dates and descriptions  
  Helpers: `getAwarenessCampaignsForRange()`, `getCityHallHolidaysForRange()`.

- **`src/components/NewsletterEngine.tsx`** — Core UI:
  - Start date / End date inputs
  - Queries DB for events in range and all recurring events (expanded into the range)
  - Merges with awareness campaigns and City Hall holidays for that timeframe
  - Renders a single sorted list of event, recurring, awareness, and holiday items.

## Data

Add events and recurring events via the Dexie API (e.g. in the browser console or a future admin UI):

```ts
import { db } from '@/lib/db';

await db.events.add({
  title: 'Town Hall',
  date: '2025-04-15',
  image: '/town-hall.jpg',
  category: 'Civic',
});

await db.recurringEvents.add({
  title: 'Council Meeting',
  frequency: 'monthly',
  dayOfMonth: 1,
  time: '19:00',
  category: 'Council',
});
```
