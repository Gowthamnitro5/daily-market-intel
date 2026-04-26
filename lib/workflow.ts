import { postMessage } from "./slack";
import { setThreadContext } from "./thread-context";
import { runAllAgents } from "./intelligence-agents";
import { dedupeFindings } from "./dedupe";
import type { IntelligenceStream } from "./types";
import { filterFreshAndNovel, filterUnpublished, markEventsSeen, savePublished } from "./database";
import { applyAltCarbonRelevanceGate } from "./relevance";
import { buildMainMessage, buildSectionMessages } from "./briefing-format";
import { generateTldrBullets } from "./llm";

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

  // LLM picks the 5 most important items and writes business implications for TL;DR.
  const tldrBullets = await generateTldrBullets(unpublishedFindings);

  // Build Slack messages in Alt-Radar style: LLM TL;DR + threaded sections.
  const mainMessage = await buildMainMessage(unpublishedFindings, tldrBullets);
  const sectionMessages = buildSectionMessages(unpublishedFindings);

  const ts = await postMessage(mainMessage, undefined, {
    unfurlLinks: false,
    unfurlMedia: false,
  });

  // Post each section as a thread reply.
  if (ts) {
    for (const sectionMsg of sectionMessages) {
      await postMessage(sectionMsg, undefined, {
        threadTs: ts,
        unfurlLinks: false,
        unfurlMedia: false,
      });
    }
  }

  const dbInserted = await savePublished(unpublishedFindings, ts);
  if (!ts) {
    await markEventsSeen(unpublishedFindings);
  }

  if (ts) {
    await setThreadContext(ts, {
      briefing: mainMessage,
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
    preview: mainMessage.slice(0, 300),
    dbInserted,
  };
}
