import axios from "axios";
import { generateText } from "ai";
import type { AgentFinding, IntelligenceStream } from "./types";
import { getEnv } from "./env";
import { freeModel } from "./model";
import { STREAM_RSS_FEEDS, STREAM_EXA_DOMAINS, STREAM_TAVILY_DOMAINS, REQUIRED_RELEVANCE_TERMS } from "./source-config";
import { isTrustedSourceUrl, isTrustedDomain } from "./relevance";

/** Carbon-native domains always pass pre-filter */
const CARBON_NATIVE_HOSTS = new Set([
  "carbonherald.com", "carboncredits.com", "carbonbrief.org", "biochartoday.com",
  "carbon180.org", "cdr.fyi", "verra.org", "goldstandard.org", "puro.earth",
  "isometric.com", "ecosystemmarketplace.com", "climatechangenews.com",
]);

/** Quick check if article text mentions any carbon term */
function hasCarbonSignal(title: string, text: string, url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (CARBON_NATIVE_HOSTS.has(host)) return true;
  } catch { /* ignore */ }
  const corpus = `${title} ${text}`.toLowerCase();
  return REQUIRED_RELEVANCE_TERMS.some((term) => corpus.includes(term));
}

type ExaResult = {
  title?: string;
  url?: string;
  publishedDate?: string;
  text?: string;
};

type TavilyResult = {
  title?: string;
  url?: string;
  published_date?: string;
  content?: string;
};

const EXA_QPS_LIMIT = 10;
const EXA_MIN_INTERVAL_MS = Math.ceil(1000 / EXA_QPS_LIMIT); // 100ms
let exaRateLimiter = Promise.resolve();
let lastExaCallAt = 0;

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    return `${u.protocol}//${u.hostname}${u.pathname}`.replace(/\/+$/, "");
  } catch {
    return url.trim();
  }
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

const STREAM_CONFIG: Record<
  IntelligenceStream,
  { exaQuery: string; tavilyQuery: string; promptGuide: string; category?: "news" | "research" }
> = {
  policy: {
    exaQuery:
      "carbon credit policy regulation Article 6 CBAM EU ETS CORSIA registry compliance CDR eligibility rules carbon market regulation",
    tavilyQuery:
      "\"carbon credit\" OR \"carbon market\" OR \"CBAM\" OR \"EU ETS\" policy regulation 2026",
    promptGuide:
      "Track policy and compliance changes that affect credit eligibility, cross-border claims, and registry acceptance.",
    category: "news",
  },
  funding: {
    exaQuery:
      "carbon removal funding investment CDR climate tech series A series B grant offtake agreement carbon credit project finance venture capital",
    tavilyQuery:
      "\"carbon removal\" OR \"carbon capture\" OR \"CDR\" funding investment raise million 2026",
    promptGuide:
      "Track financing signals that change deployment speed: debt facilities, grants, infra capex, and long-term offtakes.",
    category: "news",
  },
  market: {
    exaQuery:
      "voluntary carbon market carbon credit price issuance retirement Verra Gold Standard registry trading carbon offset demand supply",
    tavilyQuery:
      "\"carbon credit\" OR \"voluntary carbon market\" price trading retirement issuance Verra 2026",
    promptGuide:
      "Track demand-supply and liquidity signals in carbon markets: prices, retirements, issuances, and buyer concentration.",
    category: "news",
  },
  research: {
    exaQuery:
      "enhanced weathering biochar carbon removal MRV permanence additionality soil carbon direct air capture ocean alkalinity mineralization carbon sequestration study",
    tavilyQuery:
      "\"enhanced weathering\" OR \"biochar\" OR \"direct air capture\" OR \"carbon sequestration\" research study 2026",
    promptGuide:
      "Focus strictly on scientific papers and discoveries: peer-reviewed articles, preprints, methodological advances, and quantification breakthroughs.",
    category: "research",
  },
  customer: {
    exaQuery:
      "carbon removal offtake procurement net zero corporate buyer carbon credit purchase agreement Frontier Microsoft Stripe Shopify carbon negative commitment",
    tavilyQuery:
      "\"carbon credit\" OR \"carbon removal\" purchase offtake procurement corporate \"net zero\" 2026",
    promptGuide:
      "Track buyer-side intelligence: procurements, offtakes, purchasing criteria, and renewal/expansion behavior.",
    category: "news",
  },
  competitive: {
    exaQuery:
      "carbon removal startup CDR company launch partnership MRV platform registry marketplace enhanced weathering biochar direct air capture deployment",
    tavilyQuery:
      "\"carbon removal\" OR \"CDR\" startup company launch partnership MRV platform biochar 2026",
    promptGuide:
      "Track competitive moves in planetary intelligence infrastructure: registries, MRV platforms, labs, and developer networks.",
    category: "news",
  },
};

async function exaSearch(query: string, category: "news" | "research" = "news", includeDomains?: string[]): Promise<ExaResult[]> {
  const apiKey = getEnv("EXA_API_KEY");
  const scheduleExaCall = async () => {
    exaRateLimiter = exaRateLimiter.then(async () => {
      const now = Date.now();
      const waitMs = Math.max(0, EXA_MIN_INTERVAL_MS - (now - lastExaCallAt));
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      lastExaCallAt = Date.now();
    });
    await exaRateLimiter;
  };

  const now = new Date();
  const start = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
  const end = now.toISOString();

  // Try with includeDomains first; if it returns 0, retry without domain filter.
  for (const tryDomains of [includeDomains, undefined]) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await scheduleExaCall();
        const response = await axios.post(
          "https://api.exa.ai/search",
          {
            query,
            type: "neural",
            category,
            numResults: 20,
            text: true,
            useAutoprompt: true,
            startPublishedDate: start,
            endPublishedDate: end,
            ...(tryDomains && tryDomains.length > 0 ? { includeDomains: tryDomains } : {}),
          },
          {
            headers: {
              "x-api-key": apiKey,
              "content-type": "application/json",
            },
            timeout: 25000,
          },
        );

        const results = (response.data?.results ?? []) as ExaResult[];
        if (results.length > 0) return results;
        break; // 0 results with this domain set — try without
      } catch (error) {
        lastError = error;
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        const retryAfterHeader = axios.isAxiosError(error)
          ? error.response?.headers?.["retry-after"]
          : undefined;
        const retryAfterSeconds = Number(Array.isArray(retryAfterHeader) ? retryAfterHeader[0] : retryAfterHeader);
        if (status !== 429 || attempt === 2) break;
        const expBackoffMs = 800 * (attempt + 1) * 2;
        const retryAfterMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 0;
        const jitterMs = Math.floor(Math.random() * 250);
        const delayMs = Math.max(expBackoffMs, retryAfterMs) + jitterMs;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    if (!tryDomains) {
      // Already tried without domains — give up
      if (lastError) throw lastError instanceof Error ? lastError : new Error("Exa search failed");
    }
  }

  return []; // No results from either attempt
}

async function tavilySearch(query: string, includeDomains?: string[]): Promise<ExaResult[]> {
  const apiKey = getEnv("TAVILY_API_KEY");
  try {
    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: apiKey,
        query,
        search_depth: "advanced",
        topic: "news",
        days: 3,
        max_results: 20,
        include_answer: false,
        ...(includeDomains && includeDomains.length > 0 ? { include_domains: includeDomains } : {}),
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 25000,
      },
    );

    const results = (response.data?.results ?? []) as TavilyResult[];
    // Normalize to ExaResult shape for unified processing
    return results.map((r) => ({
      title: r.title,
      url: r.url,
      publishedDate: r.published_date ?? undefined,
      text: r.content?.slice(0, 800),
    }));
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    console.log(`  [Tavily] Error: ${status ?? (error instanceof Error ? error.message : "unknown")}`);
    return [];
  }
}

function extractTag(item: string, tag: string): string {
  // Handle CDATA (multiline) first, then plain tags
  const cdataRe = new RegExp(`<${tag}>[\\s]*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>[\\s]*<\\/${tag}>`, "i");
  const plainRe = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  return (item.match(cdataRe)?.[1] ?? item.match(plainRe)?.[1] ?? "").trim();
}

function parseRssItems(xml: string): ExaResult[] {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
  return itemBlocks.slice(0, 15).map((item) => {
    const title = extractTag(item, "title");
    const url = extractTag(item, "link");
    const publishedDate = extractTag(item, "pubDate") || extractTag(item, "dc:date");
    const description = extractTag(item, "description");
    // Some feeds put richer content in <content:encoded>
    const contentEncoded = extractTag(item, "content:encoded");
    const rawText = contentEncoded || description;
    const cleanText = rawText
      .replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    return {
      title: title.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim(),
      url: url.trim(),
      publishedDate: publishedDate ? new Date(publishedDate).toISOString() : undefined,
      text: cleanText.slice(0, 800),
    };
  });
}

async function rssSearch(stream: IntelligenceStream): Promise<ExaResult[]> {
  const feeds = STREAM_RSS_FEEDS[stream] ?? [];
  const results: ExaResult[] = [];
  for (const feed of feeds) {
    try {
      const res = await fetch(feed, {
        headers: { "user-agent": "Mozilla/5.0" },
        cache: "no-store",
      });
      if (!res.ok) {
        console.log(`  [RSS] ✗ ${feed.slice(0, 80)} — HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseRssItems(xml);
      console.log(`  [RSS] ✓ ${feed.slice(0, 80)} — ${items.length} items`);
      results.push(...items);
    } catch {
      console.log(`  [RSS] ✗ ${feed.slice(0, 80)} — fetch error`);
    }
  }
  return results;
}

function formatExa(results: ExaResult[]) {
  return results
    .map(
      (r, i) =>
        `${i + 1}. ${r.title ?? "Untitled"}\nURL: ${r.url ?? ""}\nPublished: ${
          r.publishedDate ?? "unknown"
        }\nSnippet: ${(r.text ?? "").slice(0, 800)}`,
    )
    .join("\n\n");
}

function stripBoilerplate(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    // Strip common site boilerplate
    .replace(/The first StrictlyVC.*?Register now\./gi, "")
    .replace(/### Topics.*?(Security|Space|Startups|TechCrunch)/gi, "")
    .replace(/Already a Member\?.*?Login here/gi, "")
    .replace(/Please login or Register.*?comment\./gi, "")
    .replace(/Action inspires action\..*?sustain/gi, "")
    .replace(/### Information you can trust.*?LSEG Pr.*/gi, "")
    .replace(/Tickets are going fast\./gi, "")
    .replace(/Register now\./gi, "")
    .trim();
}

function fallbackFromExa(stream: IntelligenceStream, exaItems: ExaResult[]): AgentFinding[] {
  return exaItems
    .filter((x) => x.url && x.title)
    .slice(0, 8)
    .map((x) => {
      const snippet = stripBoilerplate(x.text ?? "");
      const title = (x.title ?? "Untitled").trim();
      // Use RSS/Exa snippet for summary, falling back to title only as last resort.
      const summary = snippet.length > 20
        ? snippet.slice(0, 420)
        : title;
      return {
        stream,
        title,
        summary,
        entity: title.split(/[\s—–\-:,]/).slice(0, 4).join(" ").trim() || "Market",
        action: "reported development",
        sourceUrl: x.url as string,
        sourceName: domainFromUrl(x.url as string),
        publishedAt: x.publishedDate,
      };
    });
}

export async function runSpecializedAgent(
  stream: IntelligenceStream,
): Promise<AgentFinding[]> {
  const cfg = STREAM_CONFIG[stream];
  const exaDomains = STREAM_EXA_DOMAINS[stream];
  const tavilyDomains = STREAM_TAVILY_DOMAINS[stream];
  console.log(`\n━━━ ${stream.toUpperCase()} stream ━━━`);

  // Tavily as primary search
  console.log(`  [Tavily] Searching: "${cfg.tavilyQuery.slice(0, 60)}…"`);
  const tavilyItems = await tavilySearch(cfg.tavilyQuery, tavilyDomains);
  console.log(`  [Tavily] → ${tavilyItems.length} results`);
  if (tavilyItems.length > 0) {
    for (const item of tavilyItems.slice(0, 5)) {
      console.log(`    • ${(item.title ?? "Untitled").slice(0, 70)} (${domainFromUrl(item.url ?? "")})`);
    }
    if (tavilyItems.length > 5) console.log(`    … +${tavilyItems.length - 5} more`);
  }

  // Exa as fallback when Tavily returns few results
  let exaItems: ExaResult[] = [];
  if (tavilyItems.length < 5) {
    console.log(`  [Exa] Fallback search (Tavily < 5)…`);
    exaItems = await exaSearch(cfg.exaQuery, cfg.category ?? "news", exaDomains);
    console.log(`  [Exa] → ${exaItems.length} results`);
  }

  console.log(`  [RSS] Fetching ${(STREAM_RSS_FEEDS[stream] ?? []).length} feeds…`);
  const rssItems = await rssSearch(stream);
  console.log(`  [RSS] → ${rssItems.length} total items`);

  const mergedMap = new Map<string, ExaResult>();
  for (const item of [...tavilyItems, ...exaItems, ...rssItems]) {
    const key = item.url ? normalizeUrl(item.url) : "";
    if (!key) continue;
    if (!mergedMap.has(key)) mergedMap.set(key, item);
  }
  const combinedItems = Array.from(mergedMap.values());
  const trustedAll = combinedItems.filter((x) => (x.url ? isTrustedSourceUrl(x.url) : false));
  // Pre-filter: only send carbon-relevant articles to the LLM
  const trustedItems = trustedAll
    .filter((x) => hasCarbonSignal(x.title ?? "", x.text ?? "", x.url ?? ""))
    .slice(0, 25);
  console.log(`  [Merge] ${tavilyItems.length} tavily + ${exaItems.length} exa + ${rssItems.length} rss → ${mergedMap.size} unique → ${trustedAll.length} trusted → ${trustedItems.length} carbon-relevant`);
  const allowedUrls = new Set(
    trustedItems
      .map((x) => (x.url ? normalizeUrl(x.url) : ""))
      .filter(Boolean),
  );
  const sourceContext = formatExa(trustedItems);

  let text = "";
  try {
    const res = await generateText({
      model: freeModel(),
      temperature: 0.2,
      system: `You are the ${stream} intelligence agent in a carbon intelligence system.
${cfg.promptGuide}
Extract only items directly related to carbon credits, carbon removal (CDR), carbon markets, biochar, enhanced weathering, direct air capture, MRV, or carbon policy.
SKIP items about: general tech funding, AI companies, nuclear energy, EVs, crypto, general business news, or anything not specifically about carbon/CDR.
${cfg.promptGuide}
For research stream, include only paper/discovery items about carbon removal methods.
Output strictly structured findings.
Avoid duplicates and avoid invented links.`,
      prompt: `Analyze these search results and extract 4-8 findings that are SPECIFICALLY about carbon credits, carbon removal, carbon markets, or CDR technology.
REJECT any item that is not directly about carbon/CDR — even if it's from a trusted source.
Return valid JSON only with this exact shape:
{"findings":[{"title":"...","summary":"one clear sentence about what happened and why it matters for carbon markets","entity":"...","action":"...","sourceUrl":"https://...","sourceName":"...","publishedAt":"..."}]}

Do not include markdown, comments, or extra text.

Input:
${sourceContext}`,
    });
    text = res.text;
  } catch {
    return fallbackFromExa(stream, trustedItems);
  }

  const jsonMatch = text.match(/\{[\s\S]*\}$/);
  if (!jsonMatch) return fallbackFromExa(stream, trustedItems);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return fallbackFromExa(stream, trustedItems);
  }

  const findings = Array.isArray((parsed as { findings?: unknown[] }).findings)
    ? ((parsed as { findings: unknown[] }).findings as Record<string, unknown>[])
    : [];

  // Build a URL→snippet lookup so we can backfill empty LLM summaries.
  const snippetByUrl = new Map<string, string>();
  for (const item of trustedItems) {
    if (item.url && item.text) {
      snippetByUrl.set(normalizeUrl(item.url), stripBoilerplate(item.text));
    }
  }

  const mapped = findings
    .map((f) => {
      const url = normalizeUrl(String(f.sourceUrl ?? "").trim());
      let summary = stripBoilerplate(String(f.summary ?? ""));
      // Backfill empty/generic summaries with the original RSS/Exa snippet.
      if (!summary || summary === "No summary available." || summary.length < 20) {
        const snippet = snippetByUrl.get(url) ?? "";
        summary = snippet.length > 20 ? snippet.slice(0, 420) : String(f.title ?? "").trim();
      }
      return {
        stream,
        title: String(f.title ?? "").trim(),
        summary,
        entity: String(f.entity ?? "").trim(),
        action: String(f.action ?? "").trim(),
        sourceUrl: String(f.sourceUrl ?? "").trim(),
        sourceName: String(f.sourceName ?? "").trim(),
        publishedAt: String(f.publishedAt ?? "").trim() || undefined,
      };
    })
    .filter(
      (f) =>
        f.title &&
        f.summary &&
        f.entity &&
        f.action &&
        /^https?:\/\//.test(f.sourceUrl) &&
        (f.sourceName || domainFromUrl(f.sourceUrl)),
    )
    .map((f) => ({
      ...f,
      sourceUrl: normalizeUrl(f.sourceUrl),
      sourceName: f.sourceName || domainFromUrl(f.sourceUrl),
    }))
    // Ensure links are taken from actual Exa results (prevents model-truncated URLs).
    .filter((f) => allowedUrls.has(f.sourceUrl))
    .slice(0, 12);

  const final = mapped.length > 0 ? mapped : fallbackFromExa(stream, trustedItems);
  console.log(`  [Output] ${final.length} findings (${mapped.length > 0 ? "LLM extracted" : "fallback mode"})`);
  for (const f of final) {
    console.log(`    → ${f.title.slice(0, 65)} (${f.sourceName})`);
  }
  return final;
}

export async function runAllAgents(): Promise<Record<IntelligenceStream, AgentFinding[]>> {
  const streams: IntelligenceStream[] = [
    "policy",
    "funding",
    "market",
    "research",
    "customer",
    "competitive",
  ];

  const results: Record<IntelligenceStream, AgentFinding[]> = {
    policy: [],
    funding: [],
    market: [],
    research: [],
    customer: [],
    competitive: [],
  };

  // Run sequentially to reduce free-tier rate-limit spikes.
  for (const stream of streams) {
    results[stream] = await runSpecializedAgent(stream);
  }

  return streams.reduce(
    (acc, stream) => {
      acc[stream] = results[stream];
      return acc;
    },
    {} as Record<IntelligenceStream, AgentFinding[]>,
  );
}
