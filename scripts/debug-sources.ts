import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import axios from "axios";
import { getEnv } from "../lib/env";
import { STREAM_RSS_FEEDS, REQUIRED_RELEVANCE_TERMS } from "../lib/source-config";
import { isTrustedSourceUrl } from "../lib/relevance";

type ExaResult = { title?: string; url?: string; publishedDate?: string; text?: string };

async function testExa() {
  console.log("════════════════════════════════════════");
  console.log("  EXA SEARCH RESULTS");
  console.log("════════════════════════════════════════");

  const queries: Record<string, string> = {
    policy: "Article 6 carbon policy CBAM EU ETS CORSIA carbon registry rule update climate compliance law last 48 hours",
    funding: "CDR project finance debt grant structured offtake carbon removal infrastructure funding last 48 hours",
    market: "voluntary carbon market pricing retirements issuances exchange liquidity CORSIA demand last 48 hours",
    research: "enhanced weathering carbon removal paper preprint MRV discovery alkalinity groundwater geochemistry permanence additionality last 48 hours",
    customer: "carbon removal offtake procurement buyers shipping aviation cement steel net zero agreements last 48 hours",
    competitive: "carbon registry marketplace ERW developer launch partnership acquisition MRV platform last 48 hours",
  };

  const now = new Date();
  const start = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const end = now.toISOString();

  let totalExa = 0;
  let trustedExa = 0;
  let relevantExa = 0;

  for (const [stream, query] of Object.entries(queries)) {
    try {
      const resp = await axios.post(
        "https://api.exa.ai/search",
        {
          query,
          type: "neural",
          category: stream === "research" ? "research" : "news",
          numResults: 8,
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
      const results: ExaResult[] = resp.data?.results ?? [];
      const trusted = results.filter((r) => isTrustedSourceUrl(r.url ?? ""));
      const relevant = trusted.filter((r) => {
        const text = `${r.title ?? ""} ${(r.text ?? "").slice(0, 500)}`.toLowerCase();
        return REQUIRED_RELEVANCE_TERMS.some((t) => text.includes(t));
      });

      totalExa += results.length;
      trustedExa += trusted.length;
      relevantExa += relevant.length;

      console.log(`\n[${stream}] ${results.length} results | ${trusted.length} trusted | ${relevant.length} relevant`);
      for (const r of results.slice(0, 3)) {
        const t = isTrustedSourceUrl(r.url ?? "");
        const host = r.url ? new URL(r.url).hostname.replace(/^www\./, "") : "?";
        console.log(`  ${t ? "✓" : "✗"} ${host.padEnd(30)} ${(r.title ?? "").slice(0, 60)}`);
      }
      if (results.length > 3) console.log(`  ... and ${results.length - 3} more`);
    } catch (e: any) {
      console.log(`\n[${stream}] ERROR: ${e.response?.status ?? e.message}`);
    }
    // Rate limit pause
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\n── Exa Summary ──`);
  console.log(`Total results:   ${totalExa}`);
  console.log(`Trusted domains: ${trustedExa} (${totalExa ? Math.round((trustedExa / totalExa) * 100) : 0}%)`);
  console.log(`Relevant:        ${relevantExa} (${totalExa ? Math.round((relevantExa / totalExa) * 100) : 0}%)`);
  return { totalExa, trustedExa, relevantExa };
}

async function testRss() {
  console.log("\n════════════════════════════════════════");
  console.log("  RSS FEED RESULTS");
  console.log("════════════════════════════════════════");

  const now = Date.now();
  const cutoff48h = now - 48 * 60 * 60 * 1000;
  let totalRss = 0;
  let trustedRss = 0;
  let freshRss = 0;
  let relevantRss = 0;

  for (const [stream, feeds] of Object.entries(STREAM_RSS_FEEDS)) {
    let streamTotal = 0;
    let streamTrusted = 0;
    let streamFresh = 0;
    let streamRelevant = 0;

    for (const feed of feeds) {
      try {
        const res = await fetch(feed, { headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" });
        if (!res.ok) {
          console.log(`  [${stream}] HTTP ${res.status}: ${feed.slice(0, 60)}`);
          continue;
        }
        const xml = await res.text();
        const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];

        for (const item of itemBlocks) {
          const url = item.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
          const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
            item.match(/<title>(.*?)<\/title>/)?.[1] ?? "").trim();
          const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "";
          const pubTs = pubDate ? Date.parse(pubDate) : NaN;
          const isFresh = !isNaN(pubTs) && pubTs >= cutoff48h;
          const trusted = url ? isTrustedSourceUrl(url) : false;
          const text = `${title} ${(item.match(/<description>(.*?)<\/description>/)?.[1] ?? "").replace(/<[^>]+>/g, "")}`.toLowerCase();
          const relevant = REQUIRED_RELEVANCE_TERMS.some((t) => text.includes(t));

          streamTotal++;
          if (trusted) streamTrusted++;
          if (isFresh) streamFresh++;
          if (trusted && isFresh && relevant) streamRelevant++;
        }
      } catch {
        // skip
      }
    }

    totalRss += streamTotal;
    trustedRss += streamTrusted;
    freshRss += streamFresh;
    relevantRss += streamRelevant;

    console.log(`\n[${stream}] ${streamTotal} items | ${streamTrusted} trusted | ${streamFresh} fresh (<48h) | ${streamRelevant} relevant+trusted+fresh`);
  }

  console.log(`\n── RSS Summary ──`);
  console.log(`Total items:     ${totalRss}`);
  console.log(`Trusted domains: ${trustedRss} (${totalRss ? Math.round((trustedRss / totalRss) * 100) : 0}%)`);
  console.log(`Fresh (<48h):    ${freshRss}`);
  console.log(`Usable (T+F+R):  ${relevantRss}`);
  return { totalRss, trustedRss, freshRss, relevantRss };
}

async function main() {
  const exa = await testExa();
  const rss = await testRss();

  console.log("\n════════════════════════════════════════");
  console.log("  VERDICT: Where is the data coming from?");
  console.log("════════════════════════════════════════");
  console.log(`Exa:  ${exa.totalExa} total → ${exa.trustedExa} trusted → ${exa.relevantExa} usable`);
  console.log(`RSS:  ${rss.totalRss} total → ${rss.trustedRss} trusted → ${rss.freshRss} fresh → ${rss.relevantRss} usable`);

  if (exa.trustedExa === 0 && rss.relevantRss > 0) {
    console.log("\n>> RSS is carrying ALL the weight. Exa returns untrusted domains only.");
  } else if (exa.trustedExa > 0 && rss.relevantRss === 0) {
    console.log("\n>> Exa is the primary source. RSS feeds aren't contributing usable items.");
  } else if (exa.trustedExa > 0 && rss.relevantRss > 0) {
    console.log("\n>> Both sources contributing. Good.");
  } else {
    console.log("\n>> Neither source is providing usable items. Check queries and feeds.");
  }
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
