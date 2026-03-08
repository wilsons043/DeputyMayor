# Deputy Mayor 2.0 — Full Architecture & Design Audit
**Prepared as a CTO-level technical review | March 8, 2026**

---

## EXECUTIVE SUMMARY

Deputy Mayor 2.0 is a well-conceived, local-first municipal communications tool built as a React SPA. The product solves a genuine civic problem: helping a municipal official turn field visits into social media posts, council slides, and newsletters — all in one workflow. The code quality is clean and readable, TypeScript is used throughout, and the UI is functional.

However, the system has a **critical security vulnerability** that must be addressed immediately, and it carries several architectural constraints that will prevent it from scaling beyond a single user. This report documents every finding and provides a concrete path to a production-ready, multi-city SaaS platform.

---

## ⚠️ CRITICAL SECURITY FINDING — IMMEDIATE ACTION REQUIRED

**A live Gemini API key is hardcoded and committed in the `.env` file.**

The file `/Deputy Mayor 2.0/.env` contains:
```
VITE_GEMINI_API_KEY=AIzaSyCI4aadvVkdrX11outoXAbXstAi9UcPRBg
```

This is dangerous for two compounding reasons. First, the `.env` file appears to be tracked by git, meaning the key is in the repository history. Second, all `VITE_` prefixed environment variables are **bundled into the JavaScript output** by Vite and are fully visible to anyone who opens the browser developer tools, downloads the `dist/` bundle, or reads network traffic. Any browser user of this deployed app can extract this key and use it on your Gemini billing quota.

**Immediate steps:**
1. Rotate the key at https://aistudio.google.com immediately (treat it as compromised).
2. Add `.env` to `.gitignore` (`.gitignore` currently only contains `node_modules`).
3. Move the Gemini API call to a server-side proxy function — never call Gemini directly from the browser with a sensitive key.

---

## PART 1 — APPLICATION OVERVIEW

### 1.1 Purpose

Deputy Mayor 2.0 is a **local-first, AI-assisted municipal communications suite**. Its core value proposition is turning real-world field activity — photos from community visits, town halls, site inspections — into ready-to-publish content across four output channels simultaneously: Facebook, LinkedIn, X (Twitter), Instagram, council meeting slides, and a master newsletter.

The intended user is a deputy mayor, communications aide, or chief of staff at a city or municipal government who needs to move quickly from "I was just at the park renovation site" to "content is posted and the council slide is ready."

### 1.2 Intended User Workflow

The system is designed around a linear pipeline:

```
Step 1 — Field Capture Dashboard
   User is in the field. Snaps 1–10 photos. Types topic + context description.
   Clicks "Capture & Generate" → photos + text are sent to Gemini AI.
   Gemini returns: Facebook post, LinkedIn post, X post, Instagram caption,
                   slide title, slide bullet points.
   Result saved to local IndexedDB. Optionally synced to Google Drive.
        ↓
Step 2 — Social Media Kit
   Shows AI-generated posts in platform-styled previews.
   User copies each post and pastes it into the real social platform,
   or opens the platform's share URL directly.
        ↓
Step 3 — Slide Studio
   Shows a 16:9 municipal slide (dark blue/gold theme) generated from the capture.
   User picks from 4 layouts: Landmark, Briefing, Impact, Data Point.
   Downloads as high-res PNG for City Hall projector.
        ↓
Step 4 — Master Newsletter
   Aggregates events (from DB), recurring meetings, national awareness campaigns,
   City Hall holidays, and an optional Business Spotlight into a merged timeline.
   User selects a date range and builds the newsletter view.
```

### 1.3 Core System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER (SPA)                        │
│                                                             │
│  ┌──────────┐   ┌────────────────────────────────────────┐  │
│  │          │   │         React Component Tree            │  │
│  │  Vite +  │   │                                        │  │
│  │  TypeSc  │   │  App.tsx                               │  │
│  │          │   │   └── CaptureProvider (Context)        │  │
│  └──────────┘   │        └── AppContent                  │  │
│                 │             ├── FieldCaptureDashboard   │  │
│  ┌──────────┐   │             ├── SocialMediaKit          │  │
│  │ IndexedDB│◄──┤             ├── SlideStudio             │  │
│  │ (Dexie)  │   │             ├── MasterNewsletter        │  │
│  └──────────┘   │             │    └── NewsletterEngine   │  │
│                 │             └── Settings                │  │
│  ┌──────────┐   └────────────────────────────────────────┘  │
│  │Session   │                                               │
│  │Storage   │   ┌──────────────────────────────────────┐    │
│  │(DriveKey)│   │           lib/ (Services)             │    │
│  └──────────┘   │  db.ts     gemini.ts     drive.ts     │    │
│                 │  municipal.ts   slideTheme.ts          │    │
└─────────────────└──────────────────────────────────────────┘
                          │             │
                          ▼             ▼
                   ┌──────────┐  ┌──────────────┐
                   │ Gemini   │  │ Google Drive  │
                   │ AI API   │  │ API (v3)      │
                   │ (v1)     │  │ + GSI OAuth   │
                   └──────────┘  └──────────────┘
```

### 1.4 Role of Each Major Folder and Module

**`src/App.tsx`** — Root component. Owns the single piece of top-level UI state: the active `ViewId`. Renders the sidebar navigation and conditionally mounts one view at a time. Wraps everything in `CaptureProvider`.

**`src/context/CaptureContext.tsx`** — Global state bridge. Holds `latestCapture`, which is the most recently generated `GeminiCaptureResponse` enriched with topic, optional captureId, and photo preview URLs. This is the primary data bus connecting FieldCaptureDashboard (producer) to SocialMediaKit and SlideStudio (consumers).

**`src/components/FieldCaptureDashboard.tsx`** — The data entry point of the system. Manages photo selection (up to 10, with Object URL previews), form state, Gemini API submission, IndexedDB persistence, and optional Drive sync. Sets `latestCapture` in context on success.

**`src/components/SocialMediaKit.tsx`** — Content distribution station. Reads `latestCapture` from context (with a fallback to query IndexedDB for the most recent capture). Renders four platform-styled previews. Provides copy-to-clipboard and open-in-platform actions.

**`src/components/SlideStudio.tsx`** — Visual export tool. Reads `latestCapture` (same pattern as SocialKit). Renders a 16:9 HTML slide in one of four layouts. Uses `html2canvas` at 3x scale to export a PNG for projection use.

**`src/components/MasterNewsletter.tsx` + `NewsletterEngine.tsx`** — Calendar intelligence dashboard. Merges four data sources — one-off DB events, expanded recurring DB events, hardcoded national awareness campaigns, and hardcoded City Hall holidays — into a unified chronological timeline. Awareness campaign selection is persisted as a JSON array in the settings table.

**`src/components/SlideLayouts.tsx`** — Four `forwardRef` slide components: `SlideLandmark`, `SlideBriefing`, `SlideImpact`, `SlideDataPoint`. Pure presentational; receive `punchline`, `body`, `mainPhoto`, optional `scanUrl`. The `SlideDataPoint` fetches a QR code image from the external `api.qrserver.com` service.

**`src/components/SlideLayoutPicker.tsx`** — Layout selector UI component. Purely presentational.

**`src/components/Settings.tsx`** — Storage tier configuration. Allows toggling between local (IndexedDB only) and Drive (IndexedDB + Drive sync). Manages OAuth token connect/disconnect flow.

**`src/lib/db.ts`** — Dexie.js database definition. Schema v1 covers `events`, `recurringEvents`, `settings`. Schema v2 adds `fieldCaptures`. Contains `expandRecurringEvents()` — a pure function that computes concrete dates for a recurring event rule within a given date range. Contains `getSetting()` / `setSetting()` key-value helpers.

**`src/lib/gemini.ts`** — Gemini AI client. Sends multipart content (images + text prompt) to `gemini-2.5-flash` via the `@google/genai` SDK. Parses and normalizes the JSON response. Includes a mock fallback for when no API key is present.

**`src/lib/drive.ts`** — Google Drive integration. Handles OAuth 2.0 token acquisition via Google Identity Services (GSI), sessionStorage token management, folder creation, and multipart file upload for captures (JSON metadata + images).

**`src/lib/municipal.ts`** — Static domain data. Contains `MONTHLY_AWARENESS_CAMPAIGNS` (60+ campaigns across all 12 months) and `CITY_HALL_HOLIDAYS` (13 federal/municipal holidays). These are hardcoded constants. Provides range-filtering helper functions.

**`src/lib/slideTheme.ts`** — Design token file. Defines the `MUNI` color palette (navy blue #0f2847, gold #c9a227, etc.), `toPunchline()` (15-word truncator), and `bulletPoints()` (body text parser).

### 1.5 Data Flow Between Components

```
User uploads photos + topic + description
         │
         ▼
FieldCaptureDashboard
   → FileReader reads photos to base64 data URLs
   → submitFieldCaptureToGemini(images[], topic, desc)
        → GoogleGenAI.models.generateContent (multipart)
        → Parse + normalize JSON response
   → db.fieldCaptures.add(record) [IndexedDB]
   → uploadCaptureToDrive(payload) [optional, if tier=drive]
   → setLatestCapture(response + topic + photos) [Context]
         │
         ├──────────────────────────┐
         ▼                          ▼
SocialMediaKit               SlideStudio
  reads latestCapture           reads latestCapture
  (or DB fallback)              (or DB fallback)
  displays 4 posts              renders HTML slide
  copy/open actions             html2canvas → PNG download
         │
         └──────────────────────────────────────────────────┐
                                                            ▼
                                                 NewsletterEngine
                                                   db.events query
                                                   db.recurringEvents
                                                   expandRecurringEvents()
                                                   getAwarenessCampaignsForRange()
                                                   getCityHallHolidaysForRange()
                                                   → merged sorted timeline display
```

---

## PART 2 — DEEP TECHNICAL AUDIT

### 2.1 Frontend Architecture

**Framework:** React 18 functional components with hooks throughout. No class components.

**Component structure issues:**
- All 8 components live in a flat `src/components/` directory with no sub-grouping. At the current size this is manageable, but it will become difficult to navigate as the product grows.
- `SocialMediaKit.tsx` is 420 lines long. The `PlatformPreview` function is a massive switch-style conditional rendering block. Each platform (Facebook, LinkedIn, X, Instagram) is rendered through a separate `if` block that duplicates layout structure — there is no shared card component abstracted away. Each block is roughly 60–80 lines of identical structural code with different brand colors.
- All styling is done with inline style objects. There is no CSS Modules, Tailwind, or Styled Components. Inline styles mean no hover states (`:hover` pseudo-class is unavailable inline), no media queries per component, no theming variables — forcing repetition of the same hex codes and spacing values across files.
- The sidebar and layout are controlled by CSS classes in `App.css`, but all component content uses inline styles exclusively. This creates an inconsistent styling convention.

**State management:**
- Top-level view selection (`ViewId`) lives in `AppContent` local state. This is appropriate for a 5-view SPA.
- `CaptureContext` provides the single shared data unit across modules. It is intentionally thin — just `latestCapture` and its setter. This is a good, minimal design for the current scope.
- No global state library (Redux, Zustand, Jotai) is used. This is correct for the current scope.
- The newsletter date range, selected campaigns, and items all live in `NewsletterEngine` local state. This is fine but means the newsletter resets every time the user navigates away and returns.

### 2.2 Context Usage and Global State Patterns

`CaptureContext` is the only context in the application. The design is clean: a single producer (FieldCaptureDashboard) and two consumers (SocialMediaKit, SlideStudio).

However, there is a significant duplication problem: both `SocialMediaKit` and `SlideStudio` independently contain the identical `useEffect` fallback that queries IndexedDB for the latest capture when context is empty:

```tsx
// This exact pattern is copy-pasted in both components:
useEffect(() => {
  if (latestCapture) return;
  db.fieldCaptures.orderBy('createdAt').reverse().first().then((capture) => {
    if (capture) {
      try {
        const response = JSON.parse(capture.geminiResponse);
        setLatestCapture({ ...response, topic: capture.topic, ... });
      } catch { }
    }
  });
}, [latestCapture, setLatestCapture]);
```

This logic belongs in the context itself (as a lazy initializer or `useEffect` in `CaptureProvider`), not duplicated in two consumers. If a third consumer is added, the bug surface grows.

A second concern: `latestCapture` only represents **one capture at a time**. There is no capture history UI — the user cannot go back and view or re-use a capture from last week. The DB has the data, but there is no UI to access it.

### 2.3 Data Storage Strategy

**Dexie.js (IndexedDB)** is used for all local persistence. This is an excellent choice for a local-first web app. The schema design is solid:

- `events` table (indexed on `date`, `category`) — manual one-off events
- `recurringEvents` table (indexed on `frequency`, `category`) — schedule rules
- `settings` table (unique key index) — key-value app settings
- `fieldCaptures` table (indexed on `createdAt`) — AI-generated content + photos

**Concerns:**
- **Image storage in IndexedDB:** Each `FieldCaptureRecord` stores up to 10 photos as full base64 data URLs in the `imageBase64s` array. A single JPEG from a phone camera is typically 3–8 MB. Ten photos = potentially 80 MB in a single IndexedDB record. IndexedDB quotas in Chrome are typically ~60% of available disk space, but a single capture could be enormous. Over time, this will degrade performance and risk storage quota errors.
- **No pagination on fieldCaptures:** The newsletter engine queries all events in a range efficiently, but there is no UI to paginate through past captures. As the collection grows, the single latest-capture pattern will leave value on the table.
- **No data export from Dexie:** If the user switches browsers, reinstalls the OS, or wants to migrate to a new device, their entire data history is lost. The Drive sync partially addresses this, but only for captures — not for events, recurring events, or settings.
- **Schema migrations:** Two versions are defined (v1 and v2). The migration pattern is correct. However, as the schema evolves further, care must be taken because Dexie migrations are additive by nature — destructive migrations require careful version bump handling.

### 2.4 API Usage and Integration

**Gemini AI (`@google/genai` v1.44.0, `gemini-2.5-flash` model):**
- The `submitFieldCaptureToGemini` function is well-structured. It handles multi-image input, constructs a detailed system prompt, and includes robust JSON extraction and normalization logic (`extractJson`, `normalizeGeminiResponse`) to handle model response variability.
- The mock fallback for missing API key is a thoughtful DX feature.
- **Critical issue:** The API key is exposed client-side (see Security section).
- The prompt is hardcoded as a module-level constant. This is appropriate for now but will need to be configurable when supporting multiple cities with different tones.
- No retry logic — if Gemini times out or rate-limits, the user sees an error with no automatic retry.
- `temperature: 0.7` and `maxOutputTokens: 2048` are reasonable defaults.

**Google Drive (REST API v3 + Google Identity Services):**
- The Drive integration is well-built for a client-only app. The use of `drive.file` scope (only files this app creates) is appropriately minimal.
- Storing the OAuth access token in `sessionStorage` (not `localStorage`) with an expiry buffer is a correct security decision. The token is cleared when the tab closes.
- **No refresh token flow:** When the 1-hour access token expires, the user must manually reconnect. Without a backend, this is unavoidable but creates friction in long sessions.
- The multipart upload implementation in `uploadToDrive()` manually constructs MIME multipart bodies. This works but is fragile — the boundary string construction is done by hand, and a malformed header could silently fail on some Drive API versions.
- The folder-or-create pattern in `getOrCreateDeputyMayorFolder()` has a minor race condition: if two uploads happen simultaneously, two folders could be created. This is low-risk in a single-user app but worth noting.

**QR Code (`api.qrserver.com`):**
- The `SlideDataPoint` layout generates QR codes by calling an external third-party API: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=...`. This is a dependency on a service you do not control. If `api.qrserver.com` goes down, the QR code in the slide is broken — and because `html2canvas` captures the broken image, the downloaded PNG will have a blank QR box. There is no fallback or error handling for this case.

**html2canvas:**
- Used for PNG export of slides at 3x scale. This is the correct approach for a client-only tool. The `useCORS: true` and `allowTaint: true` settings are necessary for rendering base64 images but can produce tainted canvases on strict CORS configurations. A potential issue arises with the QR code image fetched from `api.qrserver.com` — CORS headers from that service may cause the image to be tainted and blocked from being included in the canvas export.

### 2.5 Security Concerns

| # | Severity | Finding |
|---|----------|---------|
| 1 | **CRITICAL** | Gemini API key (`AIzaSyCI4...`) is in a committed `.env` file and is a `VITE_` prefixed variable, meaning it is bundled into the publicly accessible JavaScript. Any user of the app can read this key. |
| 2 | **HIGH** | No authentication layer whatsoever. Deploying this to a public Vercel URL gives any visitor full access to the municipal official's data, AI credits, and Drive connection. |
| 3 | **MEDIUM** | `.gitignore` only excludes `node_modules`. `.env` is not excluded. Any future push to a GitHub/GitLab remote will expose the API key in the repository history. |
| 4 | **MEDIUM** | The `SocialMediaKit` share URL for Facebook and LinkedIn uses `window.location.href` — the URL of the SPA itself — as the shared link. This is semantically meaningless (sharing the app, not an event page). The user likely does not notice this, but it undermines the "Post on Facebook" feature. |
| 5 | **LOW** | `allowTaint: true` in `html2canvas` disables taint checking. This allows cross-origin images to be included in canvas rendering but disables browser security protections for cross-origin content. |
| 6 | **LOW** | The `getOrCreateDeputyMayorFolder` Drive function constructs a folder name query with basic string replacement `replace(/'/g, "\\'")` that is not fully injection-proof for unusual folder name characters. |

### 2.6 Environment Variable Handling

`.env.example` is correctly structured and informative. However:
- `.env` is tracked by git (critical issue as noted above).
- `VITE_GEMINI_API_KEY` should never be a `VITE_` variable — it should live in a server-side environment (Vercel Edge Function, Cloudflare Worker, etc.).
- `VITE_GOOGLE_CLIENT_ID` is acceptable as a public variable since OAuth Client IDs are safe to expose (they are protected by registered redirect URIs/origins), but it should still be externalized from `.env` that is committed.

### 2.7 Build and Deployment Configuration

**Vite:**
- Config is minimal and correct: React plugin, `@` alias to `src/`. No issues.
- TypeScript target and module settings should be reviewed for browser compatibility targets if IE/old-Edge support is needed (unlikely for a municipal tool, but worth confirming).

**Vercel (`vercel.json`):**
- Config specifies `buildCommand`, `outputDirectory`, and `framework`. This is the minimum needed and will work correctly.
- There is no `rewrites` rule (e.g., `{ "source": "/(.*)", "destination": "/" }`). Since the app uses no client-side routing library (no React Router), all navigation is internal state — this means there are no deep-linkable URLs and no 404 risk from direct URL access. This is acceptable for the current design but limits shareability and bookmarking.
- Vercel environment variables for the API keys should be set in the Vercel dashboard, **not** in a committed `.env` file.

---

## PART 3 — PRODUCT DESIGN AND WORKFLOW EVALUATION

### 3.1 The Pipeline: FieldCaptureDashboard → SlideStudio → SocialMediaKit → MasterNewsletter

The pipeline as designed is conceptually correct and addresses a real pain point. The sequence makes sense: capture in the field, get AI-generated content, distribute to social, then aggregate into a calendar-based newsletter. However, the pipeline has several workflow gaps and structural inefficiencies.

**What works well:**
- The field capture form is clean and focused. Topic + description + photos is exactly the right input surface.
- Gemini's output (4 platform posts + slide title/body in a single API call) is an efficient use of multimodal AI.
- The slide export to PNG for a City Hall projector is a practical, high-value feature.
- The awareness campaign calendar is genuinely impressive — 60+ national campaigns mapped to mayor opportunities is domain intelligence that saves hours of research.
- The `expandRecurringEvents()` function is a well-implemented algorithm that correctly handles daily, weekly, biweekly, monthly (respecting month-end edge cases), and quarterly recurrence.

**Pipeline gaps and inefficiencies:**

1. **No navigation hints between steps.** After a successful capture, the user must manually click "Social Kit" in the sidebar. There is no "Your content is ready — view Social Media Kit →" button. The pipeline is implicit; there is no guided handoff.

2. **Newsletter does not include field captures.** The `NewsletterEngine` merges events, recurring events, awareness campaigns, and holidays — but not `fieldCaptures`. The field visits that generated social posts are entirely absent from the newsletter. This is a missing connection. A "This Month's Field Visits" section in the newsletter would close the loop.

3. **Newsletter has no export.** The newsletter is a visual on-screen timeline. There is no export to HTML, PDF, plain text, or email. For a newsletter, the end goal is sending it — the current UI stops short of that. The user has to manually copy-paste or screenshot the content.

4. **Events have no CRUD UI.** The README explicitly notes that events must be added via the browser console: `await db.events.add(...)`. This is a major product gap. Any non-technical user (the primary audience) cannot add events, recurring meetings, or edit the holiday list. There is a `Settings` component but it only handles storage tier — there is no event management screen.

5. **Social share URLs are broken.** `openPostOnPlatform` for Facebook and LinkedIn passes `window.location.href` as the shared URL. This shares a link to the app itself, not to any content. The user would need to manually paste the copied text. For X, the intent URL works correctly. Instagram just opens the homepage.

6. **Capture history is inaccessible.** IndexedDB stores every capture with its Gemini response and photos. There is no UI to browse, search, or re-activate a past capture. The only way to access history is through the automatic "load latest" fallback in SocialKit and SlideStudio.

7. **Slide Studio and Social Media Kit load independently.** Both components independently execute the IndexedDB fallback query. If a user opens SlideStudio without first going through FieldCaptureDashboard in the same session, it works — but the same DB query runs twice unnecessarily.

### 3.2 Duplicated Logic

The following patterns are duplicated and should be refactored into shared abstractions:

| Duplication | Location | Recommended Fix |
|-------------|----------|-----------------|
| IndexedDB "load latest capture" effect | `SocialMediaKit`, `SlideStudio` (lines 36–52 in both) | Move to `CaptureProvider` as an initial load effect |
| `getSetting(STORAGE_TIER_KEY)` called at different points | `FieldCaptureDashboard`, `Settings` | Centralize storage tier in context or a `useStorageTier` hook |
| Inline style objects for buttons | Every component | Extract a shared `<Button>` component with variant props |
| Platform preview card structure (border, header, body, footer) | 4× in `SocialMediaKit` | Single `<PlatformCard>` component that accepts platform config |

### 3.3 Missing Abstractions

- **No shared Button component.** Every button in the app reinvents `padding`, `background`, `color`, `border`, `borderRadius`, `fontWeight`, `cursor`, `fontSize` inline. This is dozens of lines of repeated style objects.
- **No shared Card/Panel component.** The bordered panels used throughout (Settings cards, platform preview wrappers, newsletter list container) share the same `border: 1px solid #e5e7eb, borderRadius: 8, background: #fff` pattern.
- **No shared Form Input component.** Text inputs, textareas, and date pickers all repeat the same style object.
- **No page-level layout component.** Each module's outer `<section>` has its own `maxWidth` set inline. A shared `<PageSection>` component would enforce consistent layout constraints.

### 3.4 Areas Where Automation Could Improve the Process

1. **Auto-navigate to Social Kit after capture.** After a successful `handleSubmit`, automatically switch the active view to `'social-kit'`. This would turn the pipeline from implicit to explicit with zero user effort.
2. **Auto-save newsletter state.** The newsletter date range resets on every navigation. Auto-saving the last selected range in IndexedDB settings would make it persistent across sessions.
3. **Scheduled newsletter generation.** Monthly newsletters could be auto-populated via a scheduled trigger (browser notification or reminder) using the current date range logic.
4. **Auto-include captures in newsletter.** Field captures already have a `createdAt` timestamp and topic. The NewsletterEngine could automatically include captures in its timeline without any additional user action.
5. **Batch social posting.** Instead of manually opening each platform, a Zapier/Make webhook could receive a POST from the app with all four posts and schedule them to their respective platforms.

---

## PART 4 — IMPROVEMENT RECOMMENDATIONS

### 4.1 Architecture Improvements

**A. Move API calls behind a server function.** The Gemini API call must move to a Vercel Edge Function or API route. The client sends photos and topic to `/api/capture`; the server calls Gemini and returns the result. The API key never touches the browser. This solves the critical security issue.

**B. Introduce React Router.** Even with a 5-view SPA, deep-linkable URLs are valuable (`/field-capture`, `/social-kit`, etc.). React Router adds minimal overhead and enables bookmarking, browser back/forward navigation, and shared links to specific views.

**C. Replace `api.qrserver.com` with a local QR generator.** Use `qrcode` (npm package, ~45 KB gzipped) to generate QR codes entirely in the browser. This eliminates the external dependency and the CORS taint issue with `html2canvas`.

**D. Move "load latest capture" logic into CaptureProvider.** The provider should initialize itself from IndexedDB on mount, making context pre-populated for both SlideStudio and SocialMediaKit regardless of navigation order.

**E. Add error boundaries.** Wrap each major module (FieldCaptureDashboard, SlideStudio, etc.) in a React Error Boundary so a crash in one module doesn't take down the entire app.

### 4.2 Code Structure Improvements

**A. Extract a shared component library under `src/components/ui/`.** Create `Button.tsx`, `Card.tsx`, `Input.tsx`, `Textarea.tsx`, `PageSection.tsx`. Every component should use these primitives instead of inline styles.

**B. Consolidate platform rendering in SocialMediaKit.** Replace the 4× if-block structure with a single `<PlatformCard>` component that accepts a `platform: PlatformConfig` prop containing `label`, `icon`, `accentColor`, `shareUrl()`, and `copyText`. The 420-line file would compress to roughly 80 lines.

**C. Create a `useCaptureHistory` hook.** Encapsulate all IndexedDB `fieldCaptures` access (load latest, load all, load by ID) in one hook used by any component that needs capture data.

**D. Create an `EventManager` component.** Build a full CRUD UI for `events` and `recurringEvents` tables. This is the largest missing feature for non-technical users.

**E. Adopt CSS Modules or Tailwind.** CSS Modules would let components have scoped styles with proper pseudo-classes and media queries. Tailwind would further reduce boilerplate. Either is a large improvement over the current all-inline approach.

### 4.3 Performance Improvements

**A. Compress images before storing in IndexedDB.** Before calling Gemini or storing in IndexedDB, use `canvas.toDataURL('image/jpeg', 0.7)` to compress each image. A 6 MB JPEG typically compresses to ~400 KB at quality 0.7, which is still more than sufficient for Gemini's vision model and for the slide's `background: url()` rendering.

**B. Lazy load modules.** Use `React.lazy()` and `<Suspense>` to code-split each view. The current bundle loads all components eagerly. Gemini, html2canvas, and Dexie could all be lazily imported.

**C. Virtual scroll in the newsletter timeline.** For a date range spanning a full year, the merged timeline can produce hundreds of items. A virtualized list (e.g., `@tanstack/react-virtual`) would prevent DOM bloat.

**D. Memoize the `expandRecurringEvents` computation.** This is a CPU-intensive pure function. Wrapping the NewsletterEngine's call in `useMemo` keyed on the date range and recurring events array would prevent re-computation on unrelated renders.

### 4.4 Security Improvements

1. Move `VITE_GEMINI_API_KEY` to a server-side secret. Use a Vercel API route as a proxy. The client sends: `POST /api/generate-capture { images: [], topic, description }`.
2. Add `.env` to `.gitignore` immediately. Use Vercel's environment variables dashboard for production secrets.
3. Rotate the exposed Gemini API key immediately.
4. Add a `Content-Security-Policy` header in `vercel.json` to prevent XSS: `{ "headers": [{ "source": "/(.*)", "headers": [{ "key": "Content-Security-Policy", "value": "default-src 'self'; ..." }] }] }`.
5. For future authentication, use Clerk or Auth0 — both have free tiers and Vercel integrations.
6. Fix the Facebook/LinkedIn share URLs to point to actual content URLs, not `window.location.href`.

### 4.5 Developer Experience Improvements

1. **Add ESLint + Prettier.** No linting configuration exists. Adding `eslint-plugin-react-hooks` would catch the missing dependency in the `useCallback` for `handleConnectDrive`.
2. **Add Vitest + React Testing Library.** `expandRecurringEvents` in `db.ts` and the parsing logic in `gemini.ts` (`extractJson`, `normalizeGeminiResponse`) are pure functions that are ideal unit test targets.
3. **Add Storybook.** The slide layouts are excellent Storybook candidates — they're pure components with well-defined props, and seeing all 4 layouts side-by-side in Storybook would accelerate design iteration.
4. **Type the `settings` keys as a union type.** Currently `getSetting(key: string)` accepts any string. Creating `type SettingKey = 'storageTier' | 'businessSpotlight' | 'selectedAwarenessCampaignIds'` would catch typo bugs at compile time.
5. **Use `import.meta.env` type declarations.** Add a `src/env.d.ts` file that extends `ImportMetaEnv` with the specific env var names. This gives TypeScript autocomplete for environment variables.

---

## PART 5 — MUNICIPAL SAAS EVALUATION

### 5.1 Multi-City Scaling Assessment

The current architecture is **single-user, single-device, local-first**. To support multiple cities as a SaaS product, every layer of the system would need to change:

| Layer | Current State | SaaS Requirement |
|-------|--------------|-----------------|
| Storage | IndexedDB (per-browser) | Cloud database (Postgres/Supabase) |
| Auth | None | OAuth SSO per city, role-based access |
| AI API | Client-side key | Server-side per-tenant rate limiting |
| Multi-user | No | City team members share a workspace |
| Data isolation | Browser-local | Row-level security per city tenant |
| Configuration | Hardcoded holidays/campaigns | Per-city customizable + base defaults |
| Billing | N/A | Per-seat or per-city SaaS billing |

### 5.2 Required Database Architecture

A production multi-tenant architecture would require the following schema:

```sql
-- Tenant / City
CREATE TABLE cities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,  -- e.g. "st-louis-mo"
  timezone    TEXT NOT NULL DEFAULT 'America/Chicago',
  branding    JSONB,  -- primary color, logo URL, etc.
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Users (staff members at a city)
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT auth.uid(),
  city_id     UUID REFERENCES cities(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'editor',  -- 'admin' | 'editor' | 'viewer'
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Field Captures (AI-generated content)
CREATE TABLE field_captures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id         UUID REFERENCES cities(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id),
  topic           TEXT NOT NULL,
  description     TEXT,
  gemini_response JSONB NOT NULL,
  image_urls      TEXT[],  -- object storage URLs, not base64
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Events (one-off municipal events)
CREATE TABLE events (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id  UUID REFERENCES cities(id) ON DELETE CASCADE,
  title    TEXT NOT NULL,
  date     DATE NOT NULL,
  category TEXT,
  image_url TEXT
);

-- Recurring Events (schedule rules)
CREATE TABLE recurring_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id        UUID REFERENCES cities(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  frequency      TEXT NOT NULL,
  day_of_week    INT,
  day_of_month   INT,
  week_of_month  INT,
  time           TEXT,
  category       TEXT,
  end_date       DATE
);

-- Settings (per-city key-value)
CREATE TABLE settings (
  city_id UUID REFERENCES cities(id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  value   TEXT NOT NULL,
  PRIMARY KEY (city_id, key)
);

-- Row Level Security (Supabase)
ALTER TABLE field_captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "City members only" ON field_captures
  USING (city_id = (SELECT city_id FROM users WHERE id = auth.uid()));
```

**Recommended platform:** Supabase (Postgres + Auth + Storage + RLS). It provides built-in Row Level Security for multi-tenant isolation, a managed Postgres instance, S3-compatible object storage for images (replacing base64 in IndexedDB), and Auth with OAuth providers.

### 5.3 Required Backend Services

| Service | Purpose | Recommended Tool |
|---------|---------|-----------------|
| API Layer | Server-side Gemini calls, data mutations | Vercel Edge Functions or Next.js API Routes |
| Auth | City-scoped login, role management | Supabase Auth or Clerk |
| Database | Multi-tenant relational data | Supabase Postgres |
| Object Storage | Image files (replacing base64 in IndexedDB) | Supabase Storage (S3 compatible) |
| Queue / Background | Async AI generation, newsletter scheduling | Vercel Cron or Inngest |
| Email Delivery | Newsletter sending | Resend or SendGrid |
| Analytics | Usage tracking per city | PostHog |
| Billing | Per-seat SaaS pricing | Stripe |

### 5.4 Authentication and Multi-Tenant Design

**Authentication strategy:** Use Supabase Auth with Google OAuth. City IT departments already use Google Workspace, making Google OAuth the natural SSO provider. Configure `city_id` as a claim in the JWT so every request is automatically scoped.

**Multi-tenant isolation strategy:** Use **shared database, row-level security** (as opposed to separate databases per city). This is the correct tier for a startup-phase municipal SaaS with tens to low hundreds of cities. Each table has a `city_id` foreign key and Postgres RLS policies that enforce city-level isolation at the database layer. No application code can accidentally cross-contaminate tenant data.

**Role model:**
- `admin` — City IT admin. Can manage users, configure branding, set billing.
- `editor` — Communications staff. Full access to all features.
- `viewer` — Council member or stakeholder. Read-only newsletter and slide access.

**City onboarding flow:**
1. City admin signs up with their .gov email domain.
2. System auto-creates a `cities` record and an `admin` user.
3. Admin invites team members by email (Supabase Auth invite flow).
4. City configures timezone, branding colors, and custom awareness campaigns.

---

## PART 6 — PROPOSED FUTURE ARCHITECTURE

### 6.1 Recommended Folder Structure

```
deputy-mayor/
├── apps/
│   ├── web/                        # Next.js 14 App Router SPA
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── onboarding/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx      # Sidebar + city context
│   │   │   │   ├── field-capture/
│   │   │   │   ├── social-kit/
│   │   │   │   ├── slide-studio/
│   │   │   │   ├── newsletter/
│   │   │   │   ├── events/         # NEW: CRUD event manager
│   │   │   │   └── settings/
│   │   │   └── api/
│   │   │       ├── capture/        # Server action: proxies Gemini call
│   │   │       ├── newsletter/export/  # Server action: HTML/PDF export
│   │   │       └── webhooks/
│   │   ├── components/
│   │   │   ├── ui/                 # Primitives: Button, Card, Input, etc.
│   │   │   ├── slides/             # SlideLayouts, SlideLayoutPicker
│   │   │   ├── social/             # PlatformCard, SocialMediaKit
│   │   │   ├── newsletter/         # NewsletterEngine, NewsletterExport
│   │   │   └── field/              # FieldCaptureForm, CaptureHistory
│   │   ├── hooks/
│   │   │   ├── useCaptures.ts
│   │   │   ├── useEvents.ts
│   │   │   └── useStorageTier.ts
│   │   ├── lib/
│   │   │   ├── supabase/           # Supabase client (browser + server)
│   │   │   ├── municipal.ts        # Awareness campaigns (unchanged)
│   │   │   ├── slideTheme.ts       # Design tokens (unchanged)
│   │   │   └── qr.ts              # Local QR generation (replaces api.qrserver.com)
│   │   └── context/
│   │       └── CaptureContext.tsx  # With auto-init from DB
│   └── email/                      # React Email templates for newsletter
│       └── MonthlyNewsletter.tsx
├── packages/
│   └── municipal-data/             # Shared awareness campaigns + holidays (publishable)
│       ├── campaigns.ts
│       └── holidays.ts
└── supabase/
    ├── migrations/                 # SQL migrations
    └── seed.ts                     # Demo city data
```

### 6.2 Recommended Service Layer

```typescript
// lib/services/captureService.ts
export class CaptureService {
  async generate(cityId: string, input: CaptureInput): Promise<FieldCapture> {
    // 1. Upload images to Supabase Storage → get public URLs
    // 2. Call /api/capture (server-side Gemini proxy)
    // 3. Save capture record to Supabase
    // 4. Return full capture with storage URLs
  }

  async listRecent(cityId: string, limit = 20): Promise<FieldCapture[]> { ... }
  async getById(id: string): Promise<FieldCapture | null> { ... }
}

// lib/services/newsletterService.ts
export class NewsletterService {
  async build(cityId: string, range: DateRange): Promise<NewsletterContent> {
    // Parallel fetch: events, recurring, captures, campaigns, holidays
  }

  async exportHtml(content: NewsletterContent): Promise<string> { ... }
  async exportPdf(content: NewsletterContent): Promise<Blob> { ... }
  async send(content: NewsletterContent, recipients: string[]): Promise<void> { ... }
}

// lib/services/slideService.ts
export class SlideService {
  async exportPng(slideRef: RefObject<HTMLDivElement>): Promise<Blob> { ... }
  async exportPptx(capture: FieldCapture): Promise<Blob> { ... }  // future
}
```

### 6.3 Data Model Overview

```
City ─────────────┬── Users (roles: admin/editor/viewer)
                  ├── FieldCaptures (topic, description, aiResponse JSONB, imageUrls[])
                  ├── Events (date, title, category, imageUrl)
                  ├── RecurringEvents (frequency rules)
                  ├── Settings (key-value pairs)
                  └── Newsletters (generated snapshots, sent records)

FieldCapture ─────── has AiResponse {
                        facebook: string
                        linkedin: string
                        x: string
                        instagram: string
                        slideTitle: string
                        slideBody: string
                      }
                   └─ has images → Supabase Storage (object URLs, not base64)

Newsletter ────────── has items (events + recurring + captures + campaigns + holidays)
                   └─ has exports (HTML string, PDF blob URL, sent timestamp)
```

### 6.4 Scalable Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          BROWSER (Next.js)                       │
│  React Server Components + Client Components                     │
│  Supabase Auth (cookie-based sessions, RLS-enforced)            │
│  Local IndexedDB (Dexie) — offline queue for captures           │
└──────────────────┬──────────────────────────────────────────────┘
                   │  HTTPS
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL EDGE / API LAYER                       │
│                                                                  │
│  /api/capture          POST: images + topic → Gemini → response │
│  /api/newsletter/export  POST: content → HTML/PDF blob          │
│  /api/newsletter/send    POST: HTML + recipients → Resend       │
│  /api/webhooks/billing   Stripe webhook handler                 │
│                                                                  │
│  (All Gemini/API keys stored as Vercel env secrets — never      │
│   exposed to browser)                                           │
└──────────────────┬──────────────┬───────────────────────────────┘
                   │              │
          ┌────────▼───┐   ┌──────▼──────┐
          │  Supabase  │   │  Google     │
          │  Postgres  │   │  Gemini AI  │
          │  + Auth    │   │  (gemini-   │
          │  + Storage │   │  2.5-flash) │
          │  + RLS     │   └─────────────┘
          │            │
          │  Row-level │    ┌─────────────┐
          │  security  │    │   Resend    │
          │  per city  │    │  (email     │
          └─────┬──────┘    │  delivery)  │
                │           └─────────────┘
                │
          ┌─────▼──────┐    ┌─────────────┐
          │  Supabase  │    │   Stripe    │
          │  Storage   │    │  (billing   │
          │  (images   │    │  per city)  │
          │  as objects│    └─────────────┘
          │  not b64)  │
          └────────────┘
```

**Estimated city capacity at this architecture:**
- Supabase free tier: up to 500 MB database, 1 GB storage — suitable for 10–20 pilot cities.
- Supabase Pro ($25/month): 8 GB database, 100 GB storage — suitable for 200+ cities.
- Vercel Pro: unlimited API routes, edge caching — no constraint.
- Gemini API pricing: ~$0.075/1K input tokens (images ~258 tokens each). 10 field captures per city per month ≈ $0.10/city/month in AI costs.

---

## SUMMARY: PRIORITY ACTION LIST

### Immediate (this week)
1. **Rotate the exposed Gemini API key** at https://aistudio.google.com.
2. **Add `.env` to `.gitignore`** and remove it from git tracking (`git rm --cached .env`).
3. **Move Gemini call to a Vercel API route** — never call from browser.

### Short-term (next 30 days)
4. Add authentication (Clerk free tier is fastest path).
5. Build the Event Manager UI (CRUD for events + recurring events).
6. Move "load latest capture" logic into `CaptureProvider`.
7. Add newsletter export to HTML/email format.
8. Replace `api.qrserver.com` with a local QR library.
9. Fix social share URLs (pass actual content URL, not `window.location.href`).

### Medium-term (60–90 days)
10. Migrate from IndexedDB-only to Supabase for cloud persistence.
11. Add "Navigate to Social Kit" after successful capture.
12. Add capture history browser (list of past captures, re-activate any).
13. Include field captures in the newsletter timeline.
14. Extract shared UI component library (Button, Card, Input, PageSection).
15. Compress images before storage (target 400 KB per image).

### Long-term (SaaS launch readiness)
16. Multi-city database schema with Supabase RLS.
17. City onboarding flow + team invites.
18. Newsletter send via Resend/Mailchimp API.
19. Stripe billing integration.
20. PPTX export for slides (replacing PNG-only).

---

*This audit was performed against commit state as of March 8, 2026. The codebase is at v2.0.0 with a clean foundation and strong domain intelligence. With the security fix and the roadmap above, Deputy Mayor 2.0 has the core of a production-ready municipal SaaS product.*
