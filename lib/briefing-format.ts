import type { AgentFinding } from "./types";

const SECTION_ORDER = [
  "Corporate Deals",
  "Investment & Funding",
  "Policy & Regulation",
  "Science & MRV",
  "Insights & Reports",
] as const;

type SectionName = (typeof SECTION_ORDER)[number];

function toSection(stream: AgentFinding["stream"]): SectionName {
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

/**
 * Build the main Slack message with LLM-generated TL;DR bullets.
 * The LLM picks the 5 most important items and writes business implications.
 */
export async function buildMainMessage(findings: AgentFinding[], tldrBullets: string[]) {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tldrLines = tldrBullets.map((b) => `• ${b}`);

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

export function buildSectionMessages(findings: AgentFinding[]) {
  const bySection = new Map<SectionName, AgentFinding[]>();
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
