import path from "node:path";
import { writeFile } from "node:fs/promises";
import { config } from "dotenv";
import type { IntelligenceStream } from "../lib/types";

function renderFindingsSection(
  stream: IntelligenceStream,
  items: {
    title: string;
    summary: string;
    sourceUrl: string;
    sourceName: string;
    publishedAt?: string;
  }[],
) {
  if (items.length === 0) return `## ${stream}\n\n- No findings\n`;

  const lines = items.map((item) => {
    const date = item.publishedAt ? ` (published: ${item.publishedAt})` : "";
    return `- **${item.title}**${date}\n  - ${item.summary}\n  - Source: [${item.sourceName}](${item.sourceUrl})`;
  });
  return `## ${stream}\n\n${lines.join("\n")}\n`;
}

function slackToMarkdownLinks(text: string): string {
  return text.replace(/<([^|>\s]+)\|([^>]+)>/g, "[$2]($1)");
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0" },
    });
    clearTimeout(timer);
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

async function main() {
  config({ path: path.join(process.cwd(), ".env.local") });
  const freeModelFallbacks = [
    process.env.OPENROUTER_MODEL,
    "mistralai/mistral-7b-instruct:free",
    "google/gemma-2-9b-it:free",
    "qwen/qwen-2.5-7b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
  ].filter(Boolean) as string[];

  const { runAllAgents } = await import("../lib/intelligence-agents");
  const { dedupeFindings } = await import("../lib/dedupe");
  const { generateDailyBriefing } = await import("../lib/llm");
  const { filterFreshAndNovel } = await import("../lib/database");
  const { applyAltCarbonRelevanceGate } = await import("../lib/relevance");

  let selectedModel = freeModelFallbacks[0];
  let streams: Record<IntelligenceStream, Awaited<ReturnType<typeof runAllAgents>>[IntelligenceStream]> | null = null;
  let allFindings:
    | ReturnType<typeof dedupeFindings>
    | null = null;
  let stageCounts = {
    beforeDedupe: 0,
    afterDedupe: 0,
    afterRelevanceGate: 0,
    afterFreshNovel: 0,
    afterReachable: 0,
  };
  let briefing = "";

  let lastError: unknown = null;
  for (const model of freeModelFallbacks) {
    try {
      process.env.OPENROUTER_MODEL = model;
      selectedModel = model;
      streams = await runAllAgents();
      const streamNames = Object.keys(streams) as IntelligenceStream[];
      const deduped = dedupeFindings(streamNames.flatMap((s) => streams![s]));
      const relevant = applyAltCarbonRelevanceGate(deduped);
      stageCounts.beforeDedupe = streamNames.reduce((acc, s) => acc + streams![s].length, 0);
      stageCounts.afterDedupe = deduped.length;
      stageCounts.afterRelevanceGate = relevant.length;
      const freshNovel = await filterFreshAndNovel(relevant, 48);
      stageCounts.afterFreshNovel = freshNovel.length;
      const reachableChecks = await Promise.all(freshNovel.map((f) => isReachable(f.sourceUrl)));
      allFindings = freshNovel.filter((_, idx) => reachableChecks[idx]);
      stageCounts.afterReachable = allFindings.length;
      briefing = await generateDailyBriefing(allFindings);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("No endpoints found")) {
        throw error;
      }
    }
  }

  if (!streams || !allFindings || !briefing) {
    throw lastError instanceof Error
      ? lastError
      : new Error("No OpenRouter free model endpoint available.");
  }

  const streamNames = Object.keys(streams) as IntelligenceStream[];

  const now = new Date();
  const timestamp = now.toISOString();
  const file = path.join(process.cwd(), `intel-report-${now.toISOString().split("T")[0]}.md`);

  const streamStats = streamNames
    .map((s) => `- ${s}: ${streams[s].length}`)
    .join("\n");

  const filteredByStream = streamNames.reduce(
    (acc, stream) => {
      acc[stream] = allFindings.filter((f) => f.stream === stream);
      return acc;
    },
    {} as Record<IntelligenceStream, typeof allFindings>,
  );

  const streamSections = streamNames
    .map((s) => renderFindingsSection(s, filteredByStream[s]))
    .join("\n");

  const uniqueDomains = new Set(allFindings.map((f) => hostname(f.sourceUrl)));
  const withPublishedDate = allFindings.filter((f) => !!f.publishedAt).length;
  const researchShare =
    allFindings.length === 0
      ? 0
      : Math.round(
          (allFindings.filter((f) => f.stream === "research").length / allFindings.length) * 100,
        );
  const policyShare =
    allFindings.length === 0
      ? 0
      : Math.round((allFindings.filter((f) => f.stream === "policy").length / allFindings.length) * 100);

  const content = `# Daily Planetary Intelligence Report

Generated at: ${timestamp}
Model: ${process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free"}
Resolved model: ${selectedModel}

## Pipeline Summary

- Specialized streams: 6
- Total findings before dedupe: ${streamNames.reduce((acc, s) => acc + streams[s].length, 0)}
- Total findings after dedupe: ${allFindings.length}

### Findings by Stream
${streamStats}

### Filter Stage Counts
- Before dedupe: ${stageCounts.beforeDedupe}
- After dedupe: ${stageCounts.afterDedupe}
- After Alt Carbon relevance gate: ${stageCounts.afterRelevanceGate}
- After freshness + novelty (48h): ${stageCounts.afterFreshNovel}
- After URL validation: ${stageCounts.afterReachable}

### Planetary KPIs
- Source diversity (unique domains): ${uniqueDomains.size}
- Findings with explicit published timestamp: ${withPublishedDate}/${allFindings.length}
- Research/discovery share: ${researchShare}%
- Policy/regulatory share: ${policyShare}%
- Alt Carbon relevance gate: enabled (trusted domains + carbon/CDR/agri-infra relevance)

---

## Final Briefing (Slack-style)

${slackToMarkdownLinks(briefing)}

---

## Filtered Stream Findings

${streamSections}
`;

  await writeFile(file, content, "utf8");
  process.stdout.write(`Report written to: ${file}\n`);
}

main().catch((error) => {
  process.stderr.write(`Report generation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
