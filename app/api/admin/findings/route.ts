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
      counts: {
        raw: raw.length,
        deduped: deduped.length,
        relevant: relevant.length,
        fresh: fresh.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}
