# Admin Dashboard Design Spec

**Date:** 2026-04-27
**Status:** Approved
**Scope:** Personal admin panel for monitoring and controlling the Daily Market Intel pipeline

## Context

The pipeline currently runs headless — cron triggers Cloudflare Worker → Vercel API → fetches RSS/Tavily/Exa → LLM extraction → Slack post. There is no way to inspect feed health, check API quotas, browse findings, or trigger runs without CLI access. This dashboard adds a UI for all of that.

## Decisions

- **Layout:** Sidebar navigation with 7 sections (client-side tab switching, no routing)
- **UI framework:** shadcn/ui + Tailwind CSS (dark theme)
- **Auth:** None (personal use, localhost/Vercel preview)
- **Location:** `/admin` route in existing Next.js app
- **API layer:** New `/api/admin/*` routes powering the dashboard

## Tech Stack

- Next.js 16 (existing)
- Tailwind CSS v4 (new — install)
- shadcn/ui (new — install)
- Existing libs: D1 client, source-config, intelligence-agents, relevance, database

## Pages & Components

### Route: `/admin`

Single page with a fixed left sidebar and a main content area. Sidebar has icon + label for each section. Clicking a section swaps the main content (client-side state, no route changes).

### Sidebar Sections

#### 1. Overview (default)

Metric cards in a 2x2 or 3-column grid:
- **Last Run** — timestamp of last pipeline execution, status (success/failed)
- **Findings Count** — total findings delivered to Slack today
- **Feed Health** — X/Y feeds healthy (green/yellow/red badge)
- **API Quota** — Tavily and Exa remaining searches this month

Action button: **"Run Now"** — triggers `POST /api/admin/run`, shows spinner while running, displays result count on completion.

Auto-refresh: poll `GET /api/admin/status` every 60 seconds.

#### 2. Feeds

Table with columns:
- Feed URL (truncated, hover for full)
- Stream (policy/funding/market/research/customer/competitive)
- Status badge (green ✓ / red ✗)
- HTTP code
- Item count (from last check)
- Response time (ms)

Actions:
- **"Check All"** button — pings all feeds and updates the table
- Filter by stream dropdown
- Sort by status (errors first)

Data source: `GET /api/admin/feeds` — iterates `STREAM_RSS_FEEDS`, fetches each with HEAD/GET, returns status array.

#### 3. Search APIs

Two cards side-by-side:

**Tavily Card:**
- Status: healthy/error
- Quota: X/1000 used this month (progress bar)
- Last search: timestamp + result count per stream
- Test button: runs a sample query and shows results

**Exa Card:**
- Same layout as Tavily
- Shows when it was used as fallback (Tavily < 5 results)

Data source: `GET /api/admin/search` — tests both APIs with a lightweight query, returns status + results.

#### 4. Database

Two sub-sections:

**seen_events table:**
- Total row count
- Recent 20 entries (event_key, last_seen_at)
- **"Clear All"** button with confirmation dialog → `POST /api/admin/database/clear`

**published_items table:**
- Total row count
- Recent 20 entries (title, stream, source_url, first_slack_published_at)

Data source: `GET /api/admin/database` — queries D1 for counts and recent rows.

#### 5. Findings

Today's pipeline results displayed as a list/cards:
- Title + summary
- Source URL + source name
- Stream badge (color-coded)
- Filter stage indicators: ✓ dedupe / ✓ relevance / ✓ novelty (or ✗ with reason)

If no findings today, show "No findings yet — run the pipeline or wait for cron."

Data source: `GET /api/admin/findings` — runs the pipeline in dry-run mode (fetch + filter but don't post to Slack), returns all findings with stage metadata.

#### 6. Slack Preview

Shows what would be posted to Slack:
- Main message preview (formatted like the actual Slack post)
- Thread message previews (one per section)
- Channel selector dropdown (dev channel / prod channel)
- **"Send to Slack"** button → `POST /api/admin/run` with selected channel

Data source: reuses findings from the Findings tab, formats using `buildMainMessage` + `buildSectionMessages`.

#### 7. Config

Read-only display of current configuration:
- **Environment variables** — name + masked value (show first 4 chars + ****) + status (set/missing)
- **Model** — current OPENROUTER_MODEL value
- **Slack channels** — dev and prod channel IDs
- **Feed counts** — per-stream RSS feed count
- **Relevance terms** — count of required/boost/exclude terms

No edit capability (env vars are managed via Vercel CLI / .env.local).

## API Routes

All under `/api/admin/`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/status` | Pipeline status: last run time, finding counts, feed/API health summary |
| GET | `/api/admin/feeds` | Live health check of all RSS feeds |
| GET | `/api/admin/search` | Tavily + Exa API health and quota |
| GET | `/api/admin/database` | D1 table counts and recent rows |
| GET | `/api/admin/findings` | Run pipeline dry (no Slack post), return findings with stage metadata |
| POST | `/api/admin/run` | Trigger full pipeline run, post to specified Slack channel |
| POST | `/api/admin/database/clear` | Clear seen_events table |

All GET routes return JSON. No authentication (personal admin).

## Component Structure

```
app/
  admin/
    page.tsx          — main admin page, sidebar + content area
    components/
      sidebar.tsx     — navigation sidebar
      overview.tsx    — overview metrics + run button
      feeds.tsx       — RSS feed health table
      search-apis.tsx — Tavily + Exa status cards
      database.tsx    — D1 inspector + clear button
      findings.tsx    — findings browser with filter stages
      slack-preview.tsx — Slack message preview + send
      config.tsx      — env var display
  api/
    admin/
      status/route.ts
      feeds/route.ts
      search/route.ts
      database/route.ts
      database/clear/route.ts
      findings/route.ts
      run/route.ts
```

## shadcn Components Needed

- Card, CardHeader, CardContent
- Table, TableHeader, TableRow, TableCell
- Badge
- Button
- Tabs (for sub-sections within pages)
- Dialog (confirmation for destructive actions)
- Select (channel dropdown)
- Progress (quota bars)
- Skeleton (loading states)
- ScrollArea (long tables)

## Styling

- Dark theme (consistent with current app style)
- Tailwind CSS for layout
- shadcn default dark theme with minor accent color customization
- Responsive but optimized for desktop (admin panel)

## Out of Scope

- User authentication / multi-user support
- Editing RSS feeds or relevance terms from UI
- Historical run logs / analytics over time
- Mobile-optimized layout
