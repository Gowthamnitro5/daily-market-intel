import { NextResponse } from "next/server";
import { d1Query } from "@/lib/d1-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const seenCount = await d1Query("SELECT COUNT(*) as count FROM seen_events");
    const seenRecent = await d1Query(
      "SELECT event_key, last_seen_at FROM seen_events ORDER BY last_seen_at DESC LIMIT 20",
    );
    const pubCount = await d1Query("SELECT COUNT(*) as count FROM published_items");
    const pubRecent = await d1Query(
      "SELECT title, stream, source_url, first_slack_published_at FROM published_items ORDER BY first_slack_published_at DESC LIMIT 20",
    );
    return NextResponse.json({
      seenEvents: {
        count: seenCount.results[0]?.count ?? 0,
        recent: seenRecent.results,
      },
      publishedItems: {
        count: pubCount.results[0]?.count ?? 0,
        recent: pubRecent.results,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
