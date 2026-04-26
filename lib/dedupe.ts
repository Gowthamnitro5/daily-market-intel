import type { AgentFinding } from "./types";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase().replace(/\/+$/, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

function eventKey(f: AgentFinding) {
  return `${normalizeText(f.entity)}::${normalizeText(f.action)}`;
}

export function dedupeFindings(input: AgentFinding[]): AgentFinding[] {
  const byUrl = new Map<string, AgentFinding>();
  for (const finding of input) {
    const key = normalizeUrl(finding.sourceUrl);
    if (!key) continue;
    if (!byUrl.has(key)) byUrl.set(key, finding);
  }

  const byEvent = new Map<string, AgentFinding>();
  for (const finding of byUrl.values()) {
    const key = eventKey(finding);
    if (!key || key === "::") continue;
    if (!byEvent.has(key)) byEvent.set(key, finding);
  }

  const strict = Array.from(byEvent.values());
  const fallbackOnly = Array.from(byUrl.values()).filter(
    (f) => !byEvent.has(eventKey(f)),
  );

  return [...strict, ...fallbackOnly].slice(0, 40);
}
