import { NextResponse } from "next/server";
import { d1Execute } from "@/lib/d1-client";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const changes = await d1Execute("DELETE FROM seen_events");
    return NextResponse.json({ ok: true, deleted: changes });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
