import { config } from "dotenv";
import path from "node:path";

config({ path: path.join(process.cwd(), ".env.local"), override: true });

type Finding = {
  stream: "policy" | "funding" | "market" | "research" | "customer" | "competitive";
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt?: string;
};

const SECTION_ORDER = [
  "Corporate Deals",
  "Investment & Funding",
  "Policy & Regulation",
  "Science & MRV",
  "Insights & Reports",
] as const;

type SectionName = (typeof SECTION_ORDER)[number];

function toSection(stream: Finding["stream"]): SectionName {
  if (stream === "customer" || stream === "competitive") return "Corporate Deals";
  if (stream === "funding") return "Investment & Funding";
  if (stream === "policy") return "Policy & Regulation";
  if (stream === "research") return "Science & MRV";
  return "Insights & Reports";
}

function safeSourceLabel(url: string, fallback: string) {
  if (fallback && fallback !== "Source") return fallback;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

function stripAsterisks(value: string) {
  return value.replace(/\*/g, "").trim();
}

function buildMainMessage(findings: Finding[]) {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const top = findings.slice(0, 6);
  const tldrLines =
    top.length > 0
      ? top.map((f) => `• *${stripAsterisks(f.title)}* — ${stripAsterisks(f.summary.split(".")[0] || "Key development.")}`)
      : ["• *No significant CDR intelligence in the past 48 hours.*"];

  return [
    "*Alt Carbon — Market Intelligence*",
    `_${date}_`,
    "",
    "*TL;DR:*",
    ...tldrLines,
    "",
    "To know more, check the thread replies below.",
  ].join("\n");
}

function buildSectionMessages(findings: Finding[]) {
  const bySection = new Map<SectionName, Finding[]>();
  for (const s of SECTION_ORDER) bySection.set(s, []);
  for (const finding of findings) {
    bySection.get(toSection(finding.stream))?.push(finding);
  }

  const messages: string[] = [];
  for (const section of SECTION_ORDER) {
    const rows = bySection.get(section) ?? [];
    if (rows.length === 0) continue;
    const lines: string[] = [`*${section}*`, ""];
    for (let i = 0; i < rows.length; i += 1) {
      const f = rows[i];
      const title = stripAsterisks(f.title);
      const summary = stripAsterisks(f.summary || "Summary unavailable.");
      const sourceName = safeSourceLabel(f.sourceUrl, f.sourceName);
      lines.push(`${i + 1}. *${title}*`);
      lines.push(`   ${summary}`);
      lines.push(`   <${f.sourceUrl}|${sourceName}>`);
      lines.push("");
    }
    lines.push("_Action Items:_");
    lines.push("• Review implications for Alt Carbon positioning and execution.");
    messages.push(lines.join("\n"));
  }

  return messages;
}

async function main() {
  const slackMod = await import("../lib/slack");
  const { postMessage } = ((slackMod as { default?: unknown }).default ??
    (slackMod as unknown)) as {
    postMessage: (
      m: string,
      c?: string,
      options?: { threadTs?: string; unfurlLinks?: boolean; unfurlMedia?: boolean },
    ) => Promise<string | null>;
  };

  const channel = process.env.SLACK_CHANNEL_ID;
  if (!channel) {
    throw new Error("SLACK_CHANNEL_ID missing in .env.local");
  }

  // Build briefing directly from structured findings pipeline (Alt-Radar style).
  const agentMod = await import("../lib/intelligence-agents");
  const dedupeMod = await import("../lib/dedupe");
  const dbMod = await import("../lib/database");
  const relevanceMod = await import("../lib/relevance");
  const core = ((agentMod as { default?: unknown }).default ??
    (agentMod as unknown)) as { runAllAgents: () => Promise<Record<string, Finding[]>> };
  const dedupe = ((dedupeMod as { default?: unknown }).default ??
    (dedupeMod as unknown)) as { dedupeFindings: (x: Finding[]) => Finding[] };
  const db = ((dbMod as { default?: unknown }).default ??
    (dbMod as unknown)) as { filterFreshAndNovel: (x: Finding[], h?: number) => Promise<Finding[]> };
  const relevance = ((relevanceMod as { default?: unknown }).default ??
    (relevanceMod as unknown)) as { applyAltCarbonRelevanceGate: (x: Finding[]) => Finding[] };

  const streams = await core.runAllAgents();
  const merged = Object.values(streams).flat();
  const deduped = dedupe.dedupeFindings(merged);
  const relevant = relevance.applyAltCarbonRelevanceGate(deduped);
  const fresh = await db.filterFreshAndNovel(relevant, 48);

  const mainMessage = buildMainMessage(fresh);
  const threadMessages = buildSectionMessages(fresh);

  const ts = await postMessage(mainMessage, channel, {
    unfurlLinks: false,
    unfurlMedia: false,
  });
  if (!ts) {
    throw new Error("Slack did not return thread timestamp for main message.");
  }

  for (const threadMessage of threadMessages) {
    await postMessage(threadMessage, channel, {
      threadTs: ts,
      unfurlLinks: false,
      unfurlMedia: false,
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Posted Slack Alt-Radar style main+thread to channel=${channel} ts=${ts}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
