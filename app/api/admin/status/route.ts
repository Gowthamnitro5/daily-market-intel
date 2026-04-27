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
      { status: 500 }
    );
  }
}
