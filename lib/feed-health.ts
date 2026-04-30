import { STREAM_RSS_FEEDS } from "./source-config";
import { postMessage } from "./slack";

type FeedStatus = {
  url: string;
  stream: string;
  ok: boolean;
  status?: number;
  error?: string;
  itemCount?: number;
};

const ALERT_COOLDOWN_MS = 30 * 60 * 1000;
const SUPPRESSED_STATUS_BY_FEED: Record<string, number[]> = {
  // Known anti-bot block from this source; keep for content ingestion but suppress noisy alerts.
  "https://www.climatechangenews.com/feed/": [403],
};

let lastAlertKey: string | null = null;
let lastAlertAtMs = 0;

function isSuppressedFailure(feed: FeedStatus): boolean {
  if (!feed.url || !feed.status) return false;
  const suppressed = SUPPRESSED_STATUS_BY_FEED[feed.url];
  return Array.isArray(suppressed) && suppressed.includes(feed.status);
}

function buildAlertKey(failed: FeedStatus[]): string {
  return failed
    .map((f) => `${f.stream}|${f.url}|${f.status ?? f.error ?? "unknown"}`)
    .sort()
    .join(";");
}

export async function checkFeedHealth(): Promise<{
  total: number;
  healthy: number;
  failed: FeedStatus[];
}> {
  const results: FeedStatus[] = [];

  for (const [stream, feeds] of Object.entries(STREAM_RSS_FEEDS)) {
    for (const feed of feeds) {
      try {
        const res = await fetch(feed, {
          headers: { "user-agent": "Mozilla/5.0" },
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          results.push({ url: feed, stream, ok: false, status: res.status });
          continue;
        }
        const xml = await res.text();
        const itemCount = (xml.match(/<item[\s\S]*?<\/item>/g) ?? []).length;
        results.push({ url: feed, stream, ok: true, status: 200, itemCount });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        results.push({ url: feed, stream, ok: false, error: msg.slice(0, 100) });
      }
    }
  }

  const failed = results.filter((r) => !r.ok);
  return {
    total: results.length,
    healthy: results.length - failed.length,
    failed,
  };
}

export async function alertUnhealthyFeeds() {
  const health = await checkFeedHealth();

  const actionableFailed = health.failed.filter((f) => !isSuppressedFailure(f));
  if (actionableFailed.length === 0) return health;

  const alertKey = buildAlertKey(actionableFailed);
  const nowMs = Date.now();
  const isDuplicateWithinCooldown =
    lastAlertKey === alertKey && nowMs - lastAlertAtMs < ALERT_COOLDOWN_MS;
  if (isDuplicateWithinCooldown) return health;

  // Set this before posting to avoid duplicate alerts during overlapping executions.
  lastAlertKey = alertKey;
  lastAlertAtMs = nowMs;

  const lines = [
    `[Feed Health Alert] ${actionableFailed.length}/${health.total} RSS feeds are failing:`,
    "",
    ...actionableFailed.map((f) => {
      const reason = f.status ? `HTTP ${f.status}` : f.error ?? "timeout";
      return `• [${f.stream}] ${reason} — ${f.url.slice(0, 70)}`;
    }),
  ];

  const testChannel = process.env.SLACK_TEST_CHANNEL_ID;
  try {
    await postMessage(lines.join("\n"), testChannel);
  } catch {
    // If Slack is also down, we can only log
    console.error("Feed health alert:", lines.join("\n"));
  }

  return health;
}
