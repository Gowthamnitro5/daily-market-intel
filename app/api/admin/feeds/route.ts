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
