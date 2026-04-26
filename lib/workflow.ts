import { postMessage } from "./slack";
import { setThreadContext } from "./thread-context";
import { runAllAgents } from "./intelligence-agents";
import { dedupeFindings } from "./dedupe";
import type { IntelligenceStream } from "./types";
import { filterFreshAndNovel, filterUnpublished, markEventsSeen, savePublished } from "./database";
import { applyAltCarbonRelevanceGate } from "./relevance";
import { buildMainMessage, buildSectionMessages } from "./briefing-format";
import { generateTldrBullets } from "./llm";
import { alertUnhealthyFeeds } from "./feed-health";

export async function runDailyWorkflow() {
  // Monitor RSS feed health and alert on failures.
  await alertUnhealthyFeeds().catch(() => {});

  const streams = await runAllAgents();
  const streamNames = Object.keys(streams) as IntelligenceStream[];

  let allFindings = streamNames.flatMap((s) => streams[s]);
  allFindings = dedupeFindings(allFindings);
  allFindings = applyAltCarbonRelevanceGate(allFindings);

  // Try 48h window first, fall back to 72h if nothing found.
  let freshAndNovel = await filterFreshAndNovel(allFindings, 48);
  let widenedWindow = false;
  if (freshAndNovel.length === 0) {
    freshAndNovel = await filterFreshAndNovel(allFindings, 72);
    widenedWindow = true;
  }

  const unpublishedFindings = await filterUnpublished(freshAndNovel);

  if (unpublishedFindings.length === 0) {
    // Post a "quiet day" message so you know the cron ran.
    const date = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const quietMsg = [
      "*Alt Carbon — Market Intelligence*",
      `_${date}_`,
      "",
      "_No significant carbon/CDR intelligence surfaced in the past 48 hours._",
      `_Pipeline scanned ${allFindings.length} items from ${streamNames.length} streams._`,
      "",
      "Monitoring continues. The next briefing will be posted when fresh intel is detected.",
    ].join("\n");

    try {
      await postMessage(quietMsg, undefined, { unfurlLinks: false, unfurlMedia: false });
    } catch {
      // Slack down — nothing we can do
    }

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
      reason: widenedWindow
        ? "No fresh intelligence in 48h or 72h window."
        : "No fresh (<=48h) novel intelligence to publish.",
      postedThreadTs: null,
      preview: quietMsg.slice(0, 300),
      dbInserted: 0,
    };
  }

  // LLM picks the 5 most important items and writes business implications for TL;DR.
  const tldrBullets = await generateTldrBullets(unpublishedFindings);

  // Build Slack messages in Alt-Radar style: LLM TL;DR + threaded sections.
  const mainMessage = await buildMainMessage(unpublishedFindings, tldrBullets);
  const sectionMessages = buildSectionMessages(unpublishedFindings);

  // Add a note if we had to widen the window.
  const finalMessage = widenedWindow
    ? mainMessage + "\n\n_Note: 48h window was quiet — this briefing includes items from the past 72 hours._"
    : mainMessage;

  const ts = await postMessage(finalMessage, undefined, {
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
      briefing: finalMessage,
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
    preview: finalMessage.slice(0, 300),
    dbInserted,
    widenedWindow,
  };
}
