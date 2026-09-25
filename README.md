# Deputy Mayor 2.0

Local-first, date-aware municipal assistant. Build newsletters from events, recurring meetings, awareness campaigns, and City Hall holidays over a chosen date range.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173 and use the **Newsletter Engine**: pick a start and end date, then click **Build newsletter** to see the merged timeline.

## Mileage Tracker

The **Mileage** view logs city travel and turns it into a reimbursement report with maps.

- **Log a trip**: pick a starting point, optional stops, and a destination by searching an address, choosing a saved place, or using your current location. Click **Calculate route** and the tracker pulls the driving distance and draws the route on the map. Round trips double the miles. You can also type the miles by hand.
- **Rates**: the IRS standard mileage rate in effect on the trip date is applied automatically (72.5 cents through June 30, 2026 and 76 cents from July 1, 2026, per Announcement 2026-11). The table in `src/lib/mileage.ts` mirrors the IRS standard mileage rates page and records the date it was last checked. When a trip date falls after the last rate on file the app applies the latest rate and shows a warning to check irs.gov. Set a custom city rate under **Places, routes and settings** if the city reimburses differently.
- **Saved routes**: check **Save this as a route** when logging a trip, then log that same trip again with one click and no lookups. Saved places and a default starting point cut the typing further.
- **Trip log**: filter by date range, see totals, open the map for any trip, repeat or delete trips, download a CSV, or save the CSV to the Deputy Mayor Assets folder in Google Drive when Drive is connected.
- **Printable report**: a reimbursement report with the period totals, an overview map of every trip, the trip table, a map per trip, and signature lines. Click **Print or save as PDF**.

Geocoding uses OpenStreetMap Nominatim and routing uses the public OSRM demo server. Both are keyless and called from the browser. If routing is unavailable the tracker falls back to a straight-line estimate with a road factor and marks the trip as estimated. Set `VITE_NOMINATIM_URL` or `VITE_OSRM_URL` in `.env` to point at your own instances.

All trips, places, and saved routes are stored locally in the browser (Dexie/IndexedDB).

## Structure

- **`src/lib/db.ts`** — Dexie.js (IndexedDB) database:
  - `events` — one-off events (id, title, date, image, category)
  - `recurringEvents` — recurring meetings (frequency: daily/weekly/biweekly/monthly/quarterly, dayOfWeek/dayOfMonth, etc.)
  - `settings` — key/value app settings
  - `trips`, `places`, `tripTemplates` — mileage tracker records (see `src/lib/mileage.ts` for rates, routing, and CSV export)
  Includes `expandRecurringEvents()` to turn recurring rules into concrete dates in a range.

- **`src/lib/municipal.ts`** — Municipal intelligence (hardcoded):
  - **Monthly Awareness Campaigns** — title + description per month (e.g. Black History Month, Earth Month)
  - **City Hall Holidays** — observed dates and descriptions  
  Helpers: `getAwarenessCampaignsForRange()`, `getCityHallHolidaysForRange()`.

- **`src/components/MileageTracker.tsx`** — Mileage Tracker UI (trip form, log, saved routes, printable report); `RouteMap.tsx` draws routes with Leaflet and OpenStreetMap tiles.

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
