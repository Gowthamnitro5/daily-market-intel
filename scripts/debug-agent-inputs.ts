import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import axios from "axios";
import { getEnv } from "../lib/env";
import { STREAM_RSS_FEEDS, STREAM_EXA_DOMAINS, REQUIRED_RELEVANCE_TERMS } from "../lib/source-config";
import { isTrustedSourceUrl } from "../lib/relevance";

type ExaResult = { title?: string; url?: string; publishedDate?: string; text?: string };

const STREAM_QUERIES: Record<string, { query: string; category: string }> = {
  policy: { query: "carbon credit policy regulation Article 6 CBAM EU ETS CORSIA registry compliance CDR eligibility rules carbon market regulation", category: "news" },
  funding: { query: "carbon removal funding investment CDR climate tech series A series B grant offtake agreement carbon credit project finance venture capital", category: "news" },
  market: { query: "voluntary carbon market carbon credit price issuance retirement Verra Gold Standard registry trading carbon offset demand supply", category: "news" },
  research: { query: "enhanced weathering biochar carbon removal MRV permanence additionality soil carbon direct air capture ocean alkalinity mineralization carbon sequestration study", category: "research" },
  customer: { query: "carbon removal offtake procurement net zero corporate buyer carbon credit purchase agreement Frontier Microsoft Stripe Shopify carbon negative commitment", category: "news" },
  competitive: { query: "carbon removal startup CDR company launch partnership MRV platform registry marketplace enhanced weathering biochar direct air capture deployment", category: "news" },
};

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    return `${u.protocol}//${u.hostname}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    return url.trim();
  }
}

function parseRssItems(xml: string): ExaResult[] {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
  return itemBlocks.slice(0, 12).map((item) => {
    const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
      item.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
    const url = item.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
    const publishedDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ??
      item.match(/<dc:date>(.*?)<\/dc:date>/)?.[1] ?? "";
    const text = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ??
      item.match(/<description>(.*?)<\/description>/)?.[1] ?? "";
    return {
      title: title.replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
      url: url.trim(),
      publishedDate: publishedDate ? new Date(publishedDate).toISOString() : undefined,
      text: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    };
  });
}

async function main() {
  const now = new Date();
  const start = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const end = now.toISOString();

  for (const [stream, cfg] of Object.entries(STREAM_QUERIES)) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  ${stream.toUpperCase()} STREAM`);
    console.log(`${"═".repeat(60)}`);

    // 1. Exa results with includeDomains
    const domains = STREAM_EXA_DOMAINS[stream] ?? [];
    let exaItems: ExaResult[] = [];
    try {
      const resp = await axios.post("https://api.exa.ai/search", {
        query: cfg.query, type: "neural", category: cfg.category,
        numResults: 10, text: true, useAutoprompt: true,
        startPublishedDate: start, endPublishedDate: end,
        includeDomains: domains,
      }, {
        headers: { "x-api-key": getEnv("EXA_API_KEY"), "content-type": "application/json" },
        timeout: 25000,
      });
      exaItems = resp.data?.results ?? [];
    } catch (e: any) {
      console.log(`  Exa ERROR: ${e.response?.status ?? e.message}`);
    }
    const exaTrusted = exaItems.filter((r) => isTrustedSourceUrl(r.url ?? ""));
    console.log(`\n  Exa: ${exaItems.length} results, ${exaTrusted.length} trusted (sent ${domains.length} includeDomains)`);
    for (const r of exaItems.slice(0, 5)) {
      const host = r.url ? new URL(r.url).hostname.replace(/^www\./, "") : "?";
      const trusted = isTrustedSourceUrl(r.url ?? "");
      const hasText = (r.text ?? "").length > 50;
      console.log(`    ${trusted ? "✓" : "✗"} ${host.padEnd(30)} text:${hasText ? "yes" : "NO"} ${(r.title ?? "").slice(0, 50)}`);
    }

    // 2. RSS results
    const feeds = STREAM_RSS_FEEDS[stream as keyof typeof STREAM_RSS_FEEDS] ?? [];
    let rssItems: ExaResult[] = [];
    for (const feed of feeds) {
      try {
        const res = await fetch(feed, { headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" });
        if (!res.ok) continue;
        const xml = await res.text();
        rssItems.push(...parseRssItems(xml));
      } catch { /* skip */ }
    }
    const rssTrusted = rssItems.filter((r) => isTrustedSourceUrl(r.url ?? ""));
    const rssWithText = rssTrusted.filter((r) => (r.text ?? "").length > 50);
    console.log(`\n  RSS: ${rssItems.length} items, ${rssTrusted.length} trusted, ${rssWithText.length} with text`);

    // 3. Merged (what the agent actually feeds to LLM)
    const mergedMap = new Map<string, ExaResult>();
    for (const item of [...exaItems, ...rssItems]) {
      const key = item.url ? normalizeUrl(item.url) : "";
      if (!key) continue;
      if (!mergedMap.has(key)) mergedMap.set(key, item);
    }
    const combined = Array.from(mergedMap.values()).slice(0, 20);
    const trustedCombined = combined.filter((x) => isTrustedSourceUrl(x.url ?? ""));
    const trustedWithText = trustedCombined.filter((x) => (x.text ?? "").length > 50);
    console.log(`\n  Merged → LLM input: ${trustedCombined.length} trusted items, ${trustedWithText.length} with text snippets`);

    // 4. Show what the LLM actually gets
    console.log(`\n  Items sent to LLM:`);
    for (const r of trustedCombined.slice(0, 8)) {
      const host = r.url ? new URL(r.url).hostname.replace(/^www\./, "") : "?";
      const snippet = (r.text ?? "").slice(0, 80).replace(/\n/g, " ");
      const corpus = `${r.title ?? ""} ${r.text ?? ""}`.toLowerCase();
      const relevantTerms = REQUIRED_RELEVANCE_TERMS.filter((t) => corpus.includes(t));
      console.log(`    ${host.padEnd(25)} [${relevantTerms.length} terms] ${(r.title ?? "").slice(0, 50)}`);
      if (snippet) console.log(`      snippet: "${snippet}..."`);
    }

    await new Promise((r) => setTimeout(r, 150)); // rate limit
  }
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
