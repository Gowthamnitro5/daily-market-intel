import type { AgentFinding } from "./types";
import { BOOST_TERMS, EXCLUDE_TERMS, REQUIRED_RELEVANCE_TERMS, SOURCE_TIERS } from "./source-config";

const TRUSTED_DOMAIN_ALLOWLIST = new Set([
  ...SOURCE_TIERS.tier1,
  ...SOURCE_TIERS.tier2,
  ...SOURCE_TIERS.tier3,
  "economist.com",
  "iea.org",
  "worldbank.org",
  "imf.org",
  "arxiv.org",
  "frontierclimate.com",
  "spglobal.com",
  "mcgill.ca",
  "mit.edu",
  "ox.ac.uk",
  "cam.ac.uk",
  "stanford.edu",
  "iisc.ac.in",
  "ashoka.edu.in",
  "gov.uk",
  "europa.eu",
  "epa.gov",
  "energy.gov",
  "eartharxiv.org",
  "mdpi.com",
  "cdm.unfccc.int",
  "link.springer.com",
  "springer.com",
  "business-standard.com",
  "fortuneindia.com",
]);

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

function isAltCarbonRelevant(finding: AgentFinding) {
  const corpus =
    `${finding.title} ${finding.summary} ${finding.entity} ${finding.action}`.toLowerCase();
  if (EXCLUDE_TERMS.some((term) => corpus.includes(term))) {
    const hasCore = REQUIRED_RELEVANCE_TERMS.some((term) => corpus.includes(term));
    if (!hasCore) return false;
  }

  const requiredHits = REQUIRED_RELEVANCE_TERMS.filter((term) => corpus.includes(term)).length;
  const boostHits = BOOST_TERMS.filter((term) => corpus.includes(term)).length;

  // Practical threshold: at least one core relevance term.
  // For research stream, trusted scientific sources are often concise, so allow with one hit.
  if (finding.stream === "research") return requiredHits >= 1;
  return requiredHits >= 1 || (requiredHits >= 0 && boostHits >= 2);
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
