# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal admin dashboard at `/admin` with sidebar navigation to monitor and control the Daily Market Intel pipeline — feed health, search API status, database inspector, findings browser, Slack preview, and config view.

**Architecture:** Single Next.js page at `/admin` using client-side tab switching with a fixed sidebar. API routes under `/api/admin/*` power each section. All data fetched client-side with SWR-like polling. No auth.

**Tech Stack:** Next.js 16, Tailwind CSS v4, shadcn/ui (dark theme), Cloudflare D1 (existing), existing pipeline libs.

---

### Task 1: Install Tailwind CSS v4 + shadcn/ui

**Files:**
- Create: `postcss.config.mjs`
- Create: `components.json`
- Create: `lib/utils.ts`
- Create: `components/ui/button.tsx` (via shadcn CLI)
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `package.json`

- [ ] **Step 1: Install Tailwind CSS v4 and dependencies**

```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

- [ ] **Step 2: Create postcss.config.mjs**

```js
// postcss.config.mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

- [ ] **Step 3: Update app/globals.css with Tailwind imports + dark theme**

Replace the entire file with:

```css
@import "tailwindcss";

@theme {
  --color-background: #0b1220;
  --color-foreground: #f3f4f6;
  --color-card: #111827;
  --color-card-foreground: #f3f4f6;
  --color-border: #1f2937;
  --color-muted: #1f2937;
  --color-muted-foreground: #9ca3af;
  --color-accent: #7c3aed;
  --color-accent-foreground: #f3f4f6;
  --color-destructive: #ef4444;
  --color-success: #22c55e;
  --color-warning: #eab308;
  --font-sans: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--font-sans);
  background: var(--color-background);
  color: var(--color-foreground);
}

a {
  color: inherit;
}
```

- [ ] **Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Zinc
- CSS variables: Yes

This creates `components.json` and `lib/utils.ts`.

- [ ] **Step 5: Install core shadcn components**

```bash
npx shadcn@latest add button card badge table tabs dialog select progress skeleton scroll-area separator
```

- [ ] **Step 6: Update app/layout.tsx to add dark class**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Market Intelligence",
  description: "Realtime market intelligence bot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: install Tailwind CSS v4 + shadcn/ui with dark theme"
```

---

### Task 2: Admin page shell with sidebar navigation

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/components/sidebar.tsx`

- [ ] **Step 1: Create sidebar component**

Create `app/admin/components/sidebar.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Rss,
  Search,
  Database,
  FileText,
  MessageSquare,
  Settings,
} from "lucide-react";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "feeds", label: "Feeds", icon: Rss },
  { id: "search", label: "Search APIs", icon: Search },
  { id: "database", label: "Database", icon: Database },
  { id: "findings", label: "Findings", icon: FileText },
  { id: "slack", label: "Slack", icon: MessageSquare },
  { id: "config", label: "Config", icon: Settings },
] as const;

export type SectionId = (typeof sections)[number]["id"];

export function Sidebar({
  active,
  onSelect,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 border-r border-border bg-card flex flex-col py-6">
      <div className="px-5 mb-8">
        <h1 className="text-sm font-bold tracking-wide uppercase text-muted-foreground">
          Market Intel
        </h1>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active === s.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Install lucide-react icons**

```bash
npm install lucide-react
```

- [ ] **Step 3: Create admin page**

Create `app/admin/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Sidebar, type SectionId } from "./components/sidebar";

export default function AdminPage() {
  const [active, setActive] = useState<SectionId>("overview");

  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} onSelect={setActive} />
      <main className="ml-56 flex-1 p-8">
        <h2 className="text-2xl font-semibold mb-6 capitalize">{active}</h2>
        <p className="text-muted-foreground">Section content goes here.</p>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Verify dev server**

```bash
npm run dev
```

Open `http://localhost:3000/admin`. Expected: sidebar visible, clicking sections changes header.

- [ ] **Step 5: Commit**

```bash
git add app/admin/ 
git commit -m "feat: add admin page shell with sidebar navigation"
```

---

### Task 3: Overview tab with status API

**Files:**
- Create: `app/api/admin/status/route.ts`
- Create: `app/admin/components/overview.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create status API route**

Create `app/api/admin/status/route.ts`:

```ts
import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1-client";
import { STREAM_RSS_FEEDS } from "@/lib/source-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const seenResult = await d1Query("SELECT COUNT(*) as count FROM seen_events");
    const publishedResult = await d1Query("SELECT COUNT(*) as count FROM published_items");
    const lastRunResult = await d1Query(
      "SELECT first_slack_published_at FROM published_items ORDER BY first_slack_published_at DESC LIMIT 1"
    );

    const totalFeeds = Object.values(STREAM_RSS_FEEDS).flat().length;

    return NextResponse.json({
      seenEvents: seenResult.results[0]?.count ?? 0,
      publishedItems: publishedResult.results[0]?.count ?? 0,
      lastRun: lastRunResult.results[0]?.first_slack_published_at ?? null,
      totalFeeds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Create overview component**

Create `app/admin/components/overview.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Play, Clock, FileText, Rss, Database } from "lucide-react";

type Status = {
  seenEvents: number;
  publishedItems: number;
  lastRun: string | null;
  totalFeeds: number;
};

export function Overview() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/admin/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function handleRun() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/admin/run", { method: "POST" });
      const data = await res.json();
      setRunResult(data.ok ? `Posted ${data.itemsCount ?? 0} findings` : `Error: ${data.error}`);
      fetchStatus();
    } catch (e) {
      setRunResult(`Error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  const lastRunDate = status?.lastRun ? new Date(status.lastRun) : null;
  const lastRunStr = lastRunDate
    ? lastRunDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "Never";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last Run</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{lastRunStr}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.publishedItems ?? 0}</div>
            <p className="text-xs text-muted-foreground">items sent to Slack</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Feeds</CardTitle>
            <Rss className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.totalFeeds ?? 0}</div>
            <p className="text-xs text-muted-foreground">RSS feeds configured</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Seen Events</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.seenEvents ?? 0}</div>
            <p className="text-xs text-muted-foreground">in novelty filter DB</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Pipeline Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Button onClick={handleRun} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            {running ? "Running…" : "Run Pipeline Now"}
          </Button>
          {runResult && (
            <Badge variant={runResult.startsWith("Error") ? "destructive" : "default"}>
              {runResult}
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create run API route**

Create `app/api/admin/run/route.ts`:

```ts
import { NextResponse } from "next/server";
import { runDailyWorkflow } from "@/lib/workflow";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await runDailyWorkflow();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Wire overview into admin page**

Update `app/admin/page.tsx` — replace the placeholder content:

```tsx
"use client";

import { useState } from "react";
import { Sidebar, type SectionId } from "./components/sidebar";
import { Overview } from "./components/overview";

export default function AdminPage() {
  const [active, setActive] = useState<SectionId>("overview");

  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} onSelect={setActive} />
      <main className="ml-56 flex-1 p-8">
        {active === "overview" && <Overview />}
        {active !== "overview" && (
          <>
            <h2 className="text-2xl font-semibold mb-6 capitalize">{active}</h2>
            <p className="text-muted-foreground">Coming soon.</p>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Test in browser**

```bash
npm run dev
```

Open `http://localhost:3000/admin`. Expected: 4 metric cards, "Run Pipeline Now" button works.

- [ ] **Step 6: Commit**

```bash
git add app/admin/ app/api/admin/
git commit -m "feat: add overview tab with status API and run button"
```

---

### Task 4: RSS Feed Health tab

**Files:**
- Create: `app/api/admin/feeds/route.ts`
- Create: `app/admin/components/feeds.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create feeds API route**

Create `app/api/admin/feeds/route.ts`:

```ts
import { NextResponse } from "next/server";
import { STREAM_RSS_FEEDS } from "@/lib/source-config";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type FeedResult = {
  url: string;
  stream: string;
  status: "ok" | "error";
  httpCode: number | null;
  itemCount: number;
  responseTime: number;
};

export async function GET() {
  const results: FeedResult[] = [];

  const entries = Object.entries(STREAM_RSS_FEEDS) as [string, string[]][];
  const allFeeds: { url: string; stream: string }[] = [];
  const seen = new Set<string>();
  for (const [stream, urls] of entries) {
    for (const url of urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      allFeeds.push({ url, stream });
    }
  }

  const checks = allFeeds.map(async ({ url, stream }) => {
    const start = Date.now();
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15000),
      });
      const elapsed = Date.now() - start;
      let itemCount = 0;
      if (res.ok) {
        const text = await res.text();
        itemCount = (text.match(/<item[\s\S]*?<\/item>/g) ?? []).length;
      }
      return { url, stream, status: res.ok ? "ok" : "error", httpCode: res.status, itemCount, responseTime: elapsed } as FeedResult;
    } catch {
      return { url, stream, status: "error", httpCode: null, itemCount: 0, responseTime: Date.now() - start } as FeedResult;
    }
  });

  const settled = await Promise.allSettled(checks);
  for (const r of settled) {
    if (r.status === "fulfilled") results.push(r.value);
  }

  return NextResponse.json({ feeds: results, total: results.length, healthy: results.filter((f) => f.status === "ok").length });
}
```

- [ ] **Step 2: Create feeds component**

Create `app/admin/components/feeds.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw } from "lucide-react";

type FeedResult = {
  url: string;
  stream: string;
  status: "ok" | "error";
  httpCode: number | null;
  itemCount: number;
  responseTime: number;
};

type FeedsData = { feeds: FeedResult[]; total: number; healthy: number };

const streamColors: Record<string, string> = {
  policy: "bg-blue-500/20 text-blue-400",
  funding: "bg-green-500/20 text-green-400",
  market: "bg-yellow-500/20 text-yellow-400",
  research: "bg-purple-500/20 text-purple-400",
  customer: "bg-orange-500/20 text-orange-400",
  competitive: "bg-red-500/20 text-red-400",
};

export function Feeds() {
  const [data, setData] = useState<FeedsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  async function fetchFeeds() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/feeds");
      setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchFeeds(); }, []);

  if (loading && !data) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  const feeds = data?.feeds ?? [];
  const filtered = filter === "all" ? feeds : filter === "errors" ? feeds.filter((f) => f.status === "error") : feeds.filter((f) => f.stream === filter);
  const sorted = [...filtered].sort((a, b) => (a.status === "error" ? -1 : 1) - (b.status === "error" ? -1 : 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {["all", "errors", "policy", "funding", "market", "research", "customer", "competitive"].map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={fetchFeeds} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Check All</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {data?.healthy ?? 0}/{data?.total ?? 0} feeds healthy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Stream</TableHead>
                <TableHead>Feed URL</TableHead>
                <TableHead className="text-right">HTTP</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((feed, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Badge variant={feed.status === "ok" ? "default" : "destructive"} className="text-xs">
                      {feed.status === "ok" ? "OK" : "ERR"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded ${streamColors[feed.stream] ?? ""}`}>{feed.stream}</span>
                  </TableCell>
                  <TableCell className="max-w-md truncate text-xs font-mono" title={feed.url}>
                    {feed.url}
                  </TableCell>
                  <TableCell className="text-right text-xs">{feed.httpCode ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">{feed.itemCount}</TableCell>
                  <TableCell className="text-right text-xs">{feed.responseTime}ms</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Wire feeds into admin page**

Add to imports in `app/admin/page.tsx`:

```tsx
import { Feeds } from "./components/feeds";
```

Add to the render:

```tsx
{active === "feeds" && <Feeds />}
```

- [ ] **Step 4: Test in browser**

Open `/admin`, click Feeds tab. Expected: table with all RSS feeds, status badges, filter buttons work.

- [ ] **Step 5: Commit**

```bash
git add app/admin/components/feeds.tsx app/api/admin/feeds/
git commit -m "feat: add RSS feed health tab with live status checks"
```

---

### Task 5: Search APIs tab

**Files:**
- Create: `app/api/admin/search/route.ts`
- Create: `app/admin/components/search-apis.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create search API route**

Create `app/api/admin/search/route.ts`:

```ts
import { NextResponse } from "next/server";
import axios from "axios";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const tavilyResult = await checkTavily();
  const exaResult = await checkExa();
  return NextResponse.json({ tavily: tavilyResult, exa: exaResult });
}

async function checkTavily() {
  try {
    const apiKey = getEnv("TAVILY_API_KEY");
    const start = Date.now();
    const res = await axios.post("https://api.tavily.com/search", {
      api_key: apiKey,
      query: "carbon credit market",
      search_depth: "basic",
      topic: "news",
      max_results: 3,
    }, { timeout: 15000 });
    return {
      status: "healthy" as const,
      responseTime: Date.now() - start,
      resultCount: res.data?.results?.length ?? 0,
      sampleResults: (res.data?.results ?? []).slice(0, 3).map((r: { title?: string; url?: string }) => ({
        title: r.title ?? "",
        url: r.url ?? "",
      })),
    };
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    return { status: "error" as const, responseTime: 0, resultCount: 0, sampleResults: [], error: status === 432 ? "Quota exceeded" : `HTTP ${status ?? "unknown"}` };
  }
}

async function checkExa() {
  try {
    const apiKey = getEnv("EXA_API_KEY");
    const start = Date.now();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const res = await axios.post("https://api.exa.ai/search", {
      query: "carbon credit",
      type: "neural",
      category: "news",
      numResults: 3,
      text: true,
      startPublishedDate: oneDayAgo,
      endPublishedDate: now.toISOString(),
    }, {
      headers: { "x-api-key": apiKey, "content-type": "application/json" },
      timeout: 15000,
    });
    return {
      status: "healthy" as const,
      responseTime: Date.now() - start,
      resultCount: res.data?.results?.length ?? 0,
      sampleResults: (res.data?.results ?? []).slice(0, 3).map((r: { title?: string; url?: string }) => ({
        title: r.title ?? "",
        url: r.url ?? "",
      })),
    };
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    return { status: "error" as const, responseTime: 0, resultCount: 0, sampleResults: [], error: `HTTP ${status ?? "unknown"}` };
  }
}
```

- [ ] **Step 2: Create search-apis component**

Create `app/admin/components/search-apis.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Loader2, ExternalLink } from "lucide-react";

type ApiResult = {
  status: "healthy" | "error";
  responseTime: number;
  resultCount: number;
  sampleResults: { title: string; url: string }[];
  error?: string;
};

export function SearchApis() {
  const [data, setData] = useState<{ tavily: ApiResult; exa: ApiResult } | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchSearch() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/search");
      setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchSearch(); }, []);

  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  function ApiCard({ name, result }: { name: string; result: ApiResult | undefined }) {
    if (!result) return null;
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">{name}</CardTitle>
          <Badge variant={result.status === "healthy" ? "default" : "destructive"}>
            {result.status === "healthy" ? "Healthy" : result.error ?? "Error"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span>Response: {result.responseTime}ms</span>
            <span>Results: {result.resultCount}</span>
          </div>
          {result.sampleResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Sample Results</p>
              {result.sampleResults.map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-xs hover:text-accent transition-colors">
                  <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="line-clamp-1">{r.title}</span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchSearch} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ApiCard name="Tavily" result={data?.tavily} />
        <ApiCard name="Exa" result={data?.exa} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into admin page**

Add import and render case for `active === "search"` in `app/admin/page.tsx`.

- [ ] **Step 4: Test and commit**

```bash
git add app/admin/components/search-apis.tsx app/api/admin/search/
git commit -m "feat: add search APIs tab with Tavily and Exa health checks"
```

---

### Task 6: Database inspector tab

**Files:**
- Create: `app/api/admin/database/route.ts`
- Create: `app/api/admin/database/clear/route.ts`
- Create: `app/admin/components/database.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create database API route**

Create `app/api/admin/database/route.ts`:

```ts
import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const seenCount = await d1Query("SELECT COUNT(*) as count FROM seen_events");
    const seenRecent = await d1Query("SELECT event_key, last_seen_at FROM seen_events ORDER BY last_seen_at DESC LIMIT 20");
    const pubCount = await d1Query("SELECT COUNT(*) as count FROM published_items");
    const pubRecent = await d1Query(
      "SELECT title, stream, source_url, first_slack_published_at FROM published_items ORDER BY first_slack_published_at DESC LIMIT 20"
    );

    return NextResponse.json({
      seenEvents: { count: seenCount.results[0]?.count ?? 0, recent: seenRecent.results },
      publishedItems: { count: pubCount.results[0]?.count ?? 0, recent: pubRecent.results },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create database clear API route**

Create `app/api/admin/database/clear/route.ts`:

```ts
import { NextResponse } from "next/server";
import { d1Execute } from "@/lib/d1-client";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const changes = await d1Execute("DELETE FROM seen_events");
    return NextResponse.json({ ok: true, deleted: changes });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unknown" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create database component**

Create `app/admin/components/database.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RefreshCw, Loader2, Trash2 } from "lucide-react";

type DbData = {
  seenEvents: { count: number; recent: Record<string, unknown>[] };
  publishedItems: { count: number; recent: Record<string, unknown>[] };
};

export function DatabaseInspector() {
  const [data, setData] = useState<DbData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function fetchDb() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/database");
      setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleClear() {
    setClearing(true);
    try {
      await fetch("/api/admin/database/clear", { method: "POST" });
      setDialogOpen(false);
      fetchDb();
    } catch { /* ignore */ }
    finally { setClearing(false); }
  }

  useEffect(() => { fetchDb(); }, []);

  if (loading && !data) return <Skeleton className="h-96 rounded-xl" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Badge variant="outline" className="text-sm">seen_events: {data?.seenEvents.count ?? 0}</Badge>
          <Badge variant="outline" className="text-sm">published_items: {data?.publishedItems.count ?? 0}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDb} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />Clear seen_events
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clear seen_events?</DialogTitle>
                <DialogDescription>This will remove all {data?.seenEvents.count ?? 0} entries from the novelty filter. The next run will treat all articles as new.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleClear} disabled={clearing}>
                  {clearing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Confirm Clear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Recent seen_events</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Key</TableHead>
                <TableHead className="text-right">Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.seenEvents.recent ?? []).map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-mono max-w-md truncate">{String(row.event_key ?? "")}</TableCell>
                  <TableCell className="text-xs text-right">{String(row.last_seen_at ?? "")}</TableCell>
                </TableRow>
              ))}
              {(data?.seenEvents.recent ?? []).length === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No entries</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Recent published_items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Stream</TableHead>
                <TableHead className="text-right">Published At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.publishedItems.recent ?? []).map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs max-w-sm truncate">{String(row.title ?? "")}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{String(row.stream ?? "")}</Badge></TableCell>
                  <TableCell className="text-xs text-right">{String(row.first_slack_published_at ?? "")}</TableCell>
                </TableRow>
              ))}
              {(data?.publishedItems.recent ?? []).length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No entries</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Wire into admin page, test, and commit**

```bash
git add app/admin/components/database.tsx app/api/admin/database/
git commit -m "feat: add database inspector tab with clear functionality"
```

---

### Task 7: Findings browser tab

**Files:**
- Create: `app/api/admin/findings/route.ts`
- Create: `app/admin/components/findings.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create findings API route**

Create `app/api/admin/findings/route.ts`:

```ts
import { NextResponse } from "next/server";
import { runAllAgents } from "@/lib/intelligence-agents";
import { dedupeFindings } from "@/lib/dedupe";
import { applyAltCarbonRelevanceGate } from "@/lib/relevance";
import { filterFreshAndNovel } from "@/lib/database";
import type { AgentFinding } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type FindingWithStages = AgentFinding & {
  passedDedupe: boolean;
  passedRelevance: boolean;
  passedNovelty: boolean;
};

export async function GET() {
  try {
    const streams = await runAllAgents();
    const raw = Object.values(streams).flat();
    const deduped = dedupeFindings(raw);
    const dedupedUrls = new Set(deduped.map((f) => f.sourceUrl));
    const relevant = applyAltCarbonRelevanceGate(deduped);
    const relevantUrls = new Set(relevant.map((f) => f.sourceUrl));
    const fresh = await filterFreshAndNovel(relevant, 72);
    const freshUrls = new Set(fresh.map((f) => f.sourceUrl));

    const findings: FindingWithStages[] = raw.map((f) => ({
      ...f,
      passedDedupe: dedupedUrls.has(f.sourceUrl),
      passedRelevance: relevantUrls.has(f.sourceUrl),
      passedNovelty: freshUrls.has(f.sourceUrl),
    }));

    return NextResponse.json({
      findings,
      counts: { raw: raw.length, deduped: deduped.length, relevant: relevant.length, fresh: fresh.length },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create findings component**

Create `app/admin/components/findings.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, ExternalLink, Check, X } from "lucide-react";

type Finding = {
  stream: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  passedDedupe: boolean;
  passedRelevance: boolean;
  passedNovelty: boolean;
};

type FindingsData = {
  findings: Finding[];
  counts: { raw: number; deduped: number; relevant: number; fresh: number };
};

const streamColors: Record<string, string> = {
  policy: "bg-blue-500/20 text-blue-400",
  funding: "bg-green-500/20 text-green-400",
  market: "bg-yellow-500/20 text-yellow-400",
  research: "bg-purple-500/20 text-purple-400",
  customer: "bg-orange-500/20 text-orange-400",
  competitive: "bg-red-500/20 text-red-400",
};

function StageIcon({ passed }: { passed: boolean }) {
  return passed ? <Check className="h-3 w-3 text-green-400" /> : <X className="h-3 w-3 text-red-400" />;
}

export function Findings() {
  const [data, setData] = useState<FindingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "passed" | "failed">("all");

  async function fetchFindings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/findings");
      setData(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  const findings = data?.findings ?? [];
  const filtered = filter === "all" ? findings : filter === "passed" ? findings.filter((f) => f.passedNovelty) : findings.filter((f) => !f.passedNovelty);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "passed", "failed"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">{f}</Button>
          ))}
        </div>
        <Button onClick={fetchFindings} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          {loading ? "Fetching…" : data ? "Refresh" : "Fetch Findings"}
        </Button>
      </div>

      {data && (
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span>Raw: {data.counts.raw}</span>
          <span>→ Deduped: {data.counts.deduped}</span>
          <span>→ Relevant: {data.counts.relevant}</span>
          <span>→ <strong className="text-foreground">Final: {data.counts.fresh}</strong></span>
        </div>
      )}

      {!data && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Click "Fetch Findings" to run the pipeline in dry-run mode.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((f, i) => (
          <Card key={i} className={f.passedNovelty ? "" : "opacity-50"}>
            <CardContent className="py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${streamColors[f.stream] ?? ""}`}>{f.stream}</span>
                    <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-accent transition-colors flex items-center gap-1 truncate">
                      {f.title}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{f.summary}</p>
                  <p className="text-xs text-muted-foreground mt-1">{f.sourceName}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <div className="flex items-center gap-1 text-xs"><StageIcon passed={f.passedDedupe} />dedup</div>
                  <div className="flex items-center gap-1 text-xs"><StageIcon passed={f.passedRelevance} />relev</div>
                  <div className="flex items-center gap-1 text-xs"><StageIcon passed={f.passedNovelty} />novel</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into admin page, test, and commit**

```bash
git add app/admin/components/findings.tsx app/api/admin/findings/
git commit -m "feat: add findings browser with filter stage indicators"
```

---

### Task 8: Slack preview tab

**Files:**
- Create: `app/admin/components/slack-preview.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create slack-preview component**

Create `app/admin/components/slack-preview.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";

export function SlackPreview() {
  const [channel, setChannel] = useState("dev");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/run", { method: "POST" });
      const data = await res.json();
      setResult(data.ok ? `Sent ${data.itemsCount ?? 0} findings to Slack` : `Error: ${data.error}`);
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Channel:</span>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dev">Dev (C0AN4KC27SN)</SelectItem>
              <SelectItem value="prod">Prod (C0AHFFG40TX)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSend} disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          {sending ? "Sending…" : "Send to Slack"}
        </Button>
      </div>

      {result && (
        <Badge variant={result.startsWith("Error") ? "destructive" : "default"} className="text-sm">
          {result}
        </Badge>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Message Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-background rounded-lg p-4 border border-border space-y-2 text-sm">
            <p className="font-bold">Alt Carbon — Market Intelligence</p>
            <p className="text-muted-foreground italic">{new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
            <p className="mt-2 font-semibold">TL;DR:</p>
            <p className="text-muted-foreground">Use the "Fetch Findings" button in the Findings tab first, then the preview will show here.</p>
            <p className="mt-2 text-xs text-muted-foreground">Thread replies will contain full section breakdowns (Corporate Deals, Investment & Funding, etc.)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Wire into admin page, test, and commit**

```bash
git add app/admin/components/slack-preview.tsx
git commit -m "feat: add Slack preview tab with channel selector"
```

---

### Task 9: Config tab

**Files:**
- Create: `app/admin/components/config.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Create config component**

Create `app/admin/components/config.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

const ENV_VARS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "TAVILY_API_KEY",
  "EXA_API_KEY",
  "AI_GATEWAY_API_KEY",
  "CF_API_TOKEN",
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "SLACK_CHANNEL_ID",
  "CRON_SECRET",
  "CUSTOM_MESSAGE_TOKEN",
] as const;

function maskValue(val: string | undefined): string {
  if (!val) return "—";
  if (val.length <= 8) return "****";
  return val.slice(0, 4) + "****" + val.slice(-4);
}

export function Config() {
  // Environment vars are only available server-side in Next.js.
  // This component renders statically with what's available at build time.
  // For a personal admin panel, we use a server component wrapper or API route.
  // For simplicity, we render a static view and let the API provide values.

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Environment Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Values are masked. Manage via <code className="bg-muted px-1 rounded">vercel env</code> or <code className="bg-muted px-1 rounded">.env.local</code>.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variable</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ENV_VARS.map((name) => (
                <TableRow key={name}>
                  <TableCell className="font-mono text-xs">{name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">Configured via env</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pipeline Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">LLM Model</span>
            <code className="text-xs bg-muted px-2 py-0.5 rounded">nvidia/nemotron-3-super-120b-a12b:free</code>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Search Window</span>
            <span>72 hours</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Novelty Threshold</span>
            <span>0.80 similarity</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exa Results per Stream</span>
            <span>20</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tavily Results per Stream</span>
            <span>20</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cron Schedule</span>
            <code className="text-xs bg-muted px-2 py-0.5 rounded">8:00 AM IST daily</code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Wire into admin page, test, and commit**

```bash
git add app/admin/components/config.tsx
git commit -m "feat: add config tab with env var display and pipeline settings"
```

---

### Task 10: Final admin page wiring + build verification

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Update admin page with all sections**

Final `app/admin/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Sidebar, type SectionId } from "./components/sidebar";
import { Overview } from "./components/overview";
import { Feeds } from "./components/feeds";
import { SearchApis } from "./components/search-apis";
import { DatabaseInspector } from "./components/database";
import { Findings } from "./components/findings";
import { SlackPreview } from "./components/slack-preview";
import { Config } from "./components/config";

const sections: Record<SectionId, React.ComponentType> = {
  overview: Overview,
  feeds: Feeds,
  search: SearchApis,
  database: DatabaseInspector,
  findings: Findings,
  slack: SlackPreview,
  config: Config,
};

export default function AdminPage() {
  const [active, setActive] = useState<SectionId>("overview");
  const Section = sections[active];

  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} onSelect={setActive} />
      <main className="ml-56 flex-1 p-8">
        <Section />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Test all tabs in dev mode**

```bash
npm run dev
```

Open `http://localhost:3000/admin`. Verify each tab loads and renders correctly.

- [ ] **Step 4: Commit and deploy**

```bash
git add -A
git commit -m "feat: complete admin dashboard with all 7 sections"
git push origin main
```
