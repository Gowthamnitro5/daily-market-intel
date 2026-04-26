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

  if (health.failed.length === 0) return health;

  const lines = [
    `[Feed Health Alert] ${health.failed.length}/${health.total} RSS feeds are failing:`,
    "",
    ...health.failed.map((f) => {
      const reason = f.status ? `HTTP ${f.status}` : f.error ?? "timeout";
      return `• [${f.stream}] ${reason} — ${f.url.slice(0, 70)}`;
    }),
  ];

  try {
    await postMessage(lines.join("\n"));
  } catch {
    // If Slack is also down, we can only log
    console.error("Feed health alert:", lines.join("\n"));
  }

  return health;
}
