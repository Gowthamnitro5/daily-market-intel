import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { runAllAgents } from "../lib/intelligence-agents";
import { dedupeFindings } from "../lib/dedupe";
import { applyAltCarbonRelevanceGate, isTrustedSourceUrl } from "../lib/relevance";
import { REQUIRED_RELEVANCE_TERMS } from "../lib/source-config";

async function main() {
  const streams = await runAllAgents();

  // Step 1: Raw agent output — which sources appear?
  console.log("═══ STEP 1: Raw Agent Output — Sources ═══\n");
  const all = Object.values(streams).flat();
  const sourceCounts = new Map<string, number>();
  for (const f of all) {
    const host = new URL(f.sourceUrl).hostname.replace(/^www\./, "");
    sourceCounts.set(host, (sourceCounts.get(host) ?? 0) + 1);
  }
  const sorted = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [host, count] of sorted) {
    const trusted = isTrustedSourceUrl(`https://${host}/`);
    console.log(`  ${trusted ? "✓" : "✗"} ${host.padEnd(35)} ${count} items`);
  }
  console.log(`\n  Total: ${all.length} findings from ${sourceCounts.size} domains`);

  // Step 2: After dedupe
  const deduped = dedupeFindings(all);
  console.log(`\n═══ STEP 2: After Dedupe ═══`);
  console.log(`  ${all.length} → ${deduped.length} (removed ${all.length - deduped.length} dupes)\n`);

  // Step 3: Relevance gate — show what passes and what doesn't
  console.log("═══ STEP 3: Relevance Gate Detail ═══\n");
  const passed: typeof deduped = [];
  const failedTrust: typeof deduped = [];
  const failedRelevance: typeof deduped = [];

  for (const f of deduped) {
    const host = new URL(f.sourceUrl).hostname.replace(/^www\./, "");
    const trusted = isTrustedSourceUrl(f.sourceUrl);
    if (!trusted) {
      failedTrust.push(f);
      continue;
    }

    const corpus = `${f.title} ${f.summary} ${f.entity} ${f.action}`.toLowerCase();
    const hits = REQUIRED_RELEVANCE_TERMS.filter((t) => corpus.includes(t));
    if (hits.length === 0) {
      failedRelevance.push(f);
      console.log(`  ✗ RELEVANT MISS: [${f.stream}] ${host.padEnd(30)} "${f.title.slice(0, 60)}"`);
      console.log(`    No matching terms in: "${corpus.slice(0, 120)}..."`);
      console.log("");
    } else {
      passed.push(f);
    }
  }

  console.log(`  ── Summary ──`);
  console.log(`  Passed relevance:     ${passed.length}`);
  console.log(`  Failed (untrusted):   ${failedTrust.length}`);
  console.log(`  Failed (no terms):    ${failedRelevance.length}`);

  // Step 4: What passed — which sources?
  console.log(`\n═══ STEP 4: Findings That Pass All Filters ═══\n`);
  const passedSources = new Map<string, number>();
  for (const f of passed) {
    const host = new URL(f.sourceUrl).hostname.replace(/^www\./, "");
    passedSources.set(host, (passedSources.get(host) ?? 0) + 1);
  }
  for (const [host, count] of [...passedSources.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${host.padEnd(35)} ${count} items`);
  }

  // Step 5: Apply actual gate and compare
  const gated = applyAltCarbonRelevanceGate(deduped);
  console.log(`\n═══ STEP 5: Actual applyAltCarbonRelevanceGate ═══`);
  console.log(`  Input: ${deduped.length} → Output: ${gated.length}`);
  const gatedSources = new Map<string, number>();
  for (const f of gated) {
    const host = new URL(f.sourceUrl).hostname.replace(/^www\./, "");
    gatedSources.set(host, (gatedSources.get(host) ?? 0) + 1);
  }
  for (const [host, count] of [...gatedSources.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${host.padEnd(35)} ${count} items`);
  }

  // Show items with their relevance term matches
  console.log(`\n═══ STEP 6: Final Items with Relevance Matches ═══\n`);
  for (const f of gated) {
    const corpus = `${f.title} ${f.summary} ${f.entity} ${f.action}`.toLowerCase();
    const hits = REQUIRED_RELEVANCE_TERMS.filter((t) => corpus.includes(t));
    const host = new URL(f.sourceUrl).hostname.replace(/^www\./, "");
    console.log(`  [${f.stream}] ${host}`);
    console.log(`    ${f.title.slice(0, 80)}`);
    console.log(`    Terms: ${hits.join(", ")}`);
    console.log("");
  }
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
