import type { AgentFinding } from "./types";
import { ALL_TRUSTED_DOMAINS, BOOST_TERMS, EXCLUDE_TERMS, REQUIRED_RELEVANCE_TERMS, SOURCE_TIERS } from "./source-config";

const TRUSTED_DOMAIN_ALLOWLIST = new Set(ALL_TRUSTED_DOMAINS);

// Tier1 sources are carbon-specific — everything they publish is relevant by definition.
const CARBON_NATIVE_DOMAINS = new Set(SOURCE_TIERS.tier1);

const BLOCKED_DOMAIN_HINTS = [
  "pages.dev",
  "blogspot.",
  "medium.com",
  "substack.com",
  "mirror",
  "now.solar",
  "econotimes.com",
];

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isTrustedDomain(host: string) {
  if (!host) return false;
  if (BLOCKED_DOMAIN_HINTS.some((hint) => host.includes(hint))) return false;
  for (const domain of TRUSTED_DOMAIN_ALLOWLIST) {
    if (host === domain || host.endsWith(`.${domain}`)) return true;
  }
  return false;
}

function isCarbonNativeDomain(url: string): boolean {
  const host = hostname(url);
  for (const domain of CARBON_NATIVE_DOMAINS) {
    if (host === domain || host.endsWith(`.${domain}`)) return true;
  }
  return false;
}

function isAltCarbonRelevant(finding: AgentFinding) {
  // Tier1 carbon-native sources (carbonherald, biochartoday, verra, etc.)
  // only publish carbon content — auto-pass relevance check.
  if (isCarbonNativeDomain(finding.sourceUrl)) return true;

  const corpus =
    `${finding.title} ${finding.summary} ${finding.entity} ${finding.action}`.toLowerCase();
  if (EXCLUDE_TERMS.some((term) => corpus.includes(term))) {
    const hasCore = REQUIRED_RELEVANCE_TERMS.some((term) => corpus.includes(term));
    if (!hasCore) return false;
  }

  const requiredHits = REQUIRED_RELEVANCE_TERMS.filter((term) => corpus.includes(term)).length;
  const boostHits = BOOST_TERMS.filter((term) => corpus.includes(term)).length;

  // Always require at least 1 core carbon term — boost terms alone are too noisy
  if (requiredHits === 0) return false;
  if (finding.stream === "research") return requiredHits >= 1;
  return requiredHits >= 1;
}

export function applyAltCarbonRelevanceGate(findings: AgentFinding[]) {
  const trustedAndRelevant = findings.filter((f) => {
    const host = hostname(f.sourceUrl);
    return isTrustedDomain(host) && isAltCarbonRelevant(f);
  });

  // Controlled fail-open: allow trusted domains + at least one relevance term.
  if (trustedAndRelevant.length > 0) return trustedAndRelevant;
  const trustedWithLightRelevance = findings.filter((f) => {
    const host = hostname(f.sourceUrl);
    if (!isTrustedDomain(host)) return false;
    const corpus = `${f.title} ${f.summary} ${f.entity} ${f.action}`.toLowerCase();
    return REQUIRED_RELEVANCE_TERMS.some((term) => corpus.includes(term));
  });

  if (trustedWithLightRelevance.length > 0) return trustedWithLightRelevance;

  // Final fail-open: trusted domains only, keeps report alive when upstream extraction is noisy.
  return findings.filter((f) => isTrustedDomain(hostname(f.sourceUrl)));
}

export function isTrustedSourceUrl(url: string) {
  return isTrustedDomain(hostname(url));
}
