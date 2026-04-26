import { generateDailyBriefing } from "./llm";
import { postMessage } from "./slack";
import { setThreadContext } from "./thread-context";
import { runAllAgents } from "./intelligence-agents";
import { dedupeFindings } from "./dedupe";
import type { IntelligenceStream } from "./types";
import { filterFreshAndNovel, filterUnpublished, markEventsSeen, savePublished } from "./database";
import { applyAltCarbonRelevanceGate } from "./relevance";

export async function runDailyWorkflow() {
  const streams = await runAllAgents();
  const streamNames = Object.keys(streams) as IntelligenceStream[];

  let allFindings = streamNames.flatMap((s) => streams[s]);
  allFindings = dedupeFindings(allFindings);
  allFindings = applyAltCarbonRelevanceGate(allFindings);
  const freshAndNovel = await filterFreshAndNovel(allFindings, 48);
  const unpublishedFindings = await filterUnpublished(freshAndNovel);

  if (unpublishedFindings.length === 0) {
    return {
      itemsCount: 0,
      streamCounts: streamNames.reduce(
        (acc, stream) => {
          acc[stream] = 0;
          return acc;
        },
        {} as Record<string, number>,
      ),
      skipped: true,
      reason: "No fresh (<=48h) novel intelligence to publish.",
      postedThreadTs: null,
      preview: "",
      dbInserted: 0,
    };
  }

  const briefing = await generateDailyBriefing(unpublishedFindings);
  const ts = await postMessage(briefing);
  const dbInserted = await savePublished(unpublishedFindings, ts);
  if (!ts) {
    await markEventsSeen(unpublishedFindings);
  }

  if (ts) {
    await setThreadContext(ts, {
      briefing,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    itemsCount: unpublishedFindings.length,
    streamCounts: streamNames.reduce(
      (acc, stream) => {
        acc[stream] = unpublishedFindings.filter((f) => f.stream === stream).length;
        return acc;
      },
      {} as Record<string, number>,
    ),
    postedThreadTs: ts,
    preview: briefing.slice(0, 300),
    dbInserted,
  };
}
