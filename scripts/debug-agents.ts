import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { runAllAgents } from "../lib/intelligence-agents";
import { dedupeFindings } from "../lib/dedupe";
import { applyAltCarbonRelevanceGate, isTrustedSourceUrl } from "../lib/relevance";
import { filterFreshAndNovel, filterUnpublished } from "../lib/database";
import axios from "axios";
import { getEnv } from "../lib/env";
import { STREAM_RSS_FEEDS } from "../lib/source-config";

async function main() {
  // Step 1: Test Exa API directly
  console.log("=== STEP 1: Exa API Test ===");
  try {
    const now = new Date();
    const start = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const end = now.toISOString();
    const resp = await axios.post(
      "https://api.exa.ai/search",
      {
        query: "carbon credit CDR carbon removal biochar enhanced weathering MRV methodology",
        type: "neural",
        category: "news",
        numResults: 5,
        text: true,
        useAutoprompt: true,
        startPublishedDate: start,
        endPublishedDate: end,
      },
      {
        headers: { "x-api-key": getEnv("EXA_API_KEY"), "content-type": "application/json" },
        timeout: 25000,
      },
    );
    const results = resp.data?.results ?? [];
    console.log(`Exa returned ${results.length} results`);
    for (const r of results) {
      const trusted = isTrustedSourceUrl(r.url ?? "");
      console.log(`  - [${r.publishedDate?.slice(0, 10) ?? "no-date"}] ${(r.title ?? "").slice(0, 80)}`);
      console.log(`    URL: ${(r.url ?? "").slice(0, 80)} | Trusted: ${trusted}`);
    }
  } catch (e: any) {
    console.log(`Exa error: ${e.response?.status ?? e.message}`);
    if (e.response?.data) console.log(`  Detail: ${JSON.stringify(e.response.data).slice(0, 300)}`);
  }

  // Step 2: Test RSS feeds
  console.log("\n=== STEP 2: RSS Feed Test ===");
  for (const [stream, feeds] of Object.entries(STREAM_RSS_FEEDS)) {
    let total = 0;
    let failed = 0;
    for (const feed of feeds) {
      try {
        const res = await fetch(feed, { headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" });
        if (res.ok) {
          const xml = await res.text();
          const items = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
          total += items.length;
        } else {
          failed++;
          console.log(`  [${stream}] HTTP ${res.status}: ${feed.slice(0, 70)}`);
        }
      } catch (e: any) {
        failed++;
        console.log(`  [${stream}] ERROR: ${feed.slice(0, 70)} -> ${(e.message ?? "").slice(0, 60)}`);
      }
    }
    console.log(`  ${stream}: ${total} RSS items from ${feeds.length - failed}/${feeds.length} feeds`);
  }

  // Step 3: Run full agent pipeline
  console.log("\n=== STEP 3: Full Agent Pipeline ===");
  const streams = await runAllAgents();
  for (const [stream, findings] of Object.entries(streams)) {
    console.log(`  ${stream}: ${findings.length} raw findings`);
    for (const f of findings.slice(0, 2)) {
      console.log(`    - ${f.title.slice(0, 70)}`);
      console.log(`      src: ${f.sourceUrl.slice(0, 70)} | trusted: ${isTrustedSourceUrl(f.sourceUrl)}`);
    }
  }

  // Step 4: Pipeline filters
  const all = Object.values(streams).flat();
  console.log(`\n=== STEP 4: Filter Pipeline ===`);
  console.log(`Raw from agents:        ${all.length}`);
  const deduped = dedupeFindings(all);
  console.log(`After dedupe:           ${deduped.length}`);
  const relevant = applyAltCarbonRelevanceGate(deduped);
  console.log(`After relevance gate:   ${relevant.length}`);
  const fresh = await filterFreshAndNovel(relevant, 48);
  console.log(`After fresh+novel:      ${fresh.length}`);
  const unpub = await filterUnpublished(fresh);
  console.log(`After unpublished:      ${unpub.length}`);

  if (unpub.length === 0 && fresh.length > 0) {
    console.log("\n>> Items exist but already published in DB — pipeline working, just deduping.");
  }
  if (unpub.length === 0 && relevant.length > 0 && fresh.length === 0) {
    console.log("\n>> Items found but none are fresh (<48h). publishedAt dates may be missing or stale.");
    for (const f of relevant.slice(0, 5)) {
      console.log(`   publishedAt: ${f.publishedAt ?? "MISSING"} | ${f.title.slice(0, 60)}`);
    }
  }
  if (all.length === 0) {
    console.log("\n>> PROBLEM: Agents returned 0 findings. Exa or LLM failing silently.");
  }
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
