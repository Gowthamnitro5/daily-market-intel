import axios from "axios";
import { generateText } from "ai";
import type { AgentFinding, IntelligenceStream } from "./types";
import { getEnv } from "./env";
import { freeModel } from "./model";
import { STREAM_RSS_FEEDS, STREAM_EXA_DOMAINS } from "./source-config";
import { isTrustedSourceUrl } from "./relevance";

type ExaResult = {
  title?: string;
  url?: string;
  publishedDate?: string;
  text?: string;
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
  { exaQuery: string; promptGuide: string; category?: "news" | "research" }
> = {
  policy: {
    exaQuery:
      "carbon credit policy regulation Article 6 CBAM EU ETS CORSIA registry compliance CDR eligibility rules carbon market regulation",
    promptGuide:
      "Track policy and compliance changes that affect credit eligibility, cross-border claims, and registry acceptance.",
    category: "news",
  },
  funding: {
    exaQuery:
      "carbon removal funding investment CDR climate tech series A series B grant offtake agreement carbon credit project finance venture capital",
    promptGuide:
      "Track financing signals that change deployment speed: debt facilities, grants, infra capex, and long-term offtakes.",
    category: "news",
  },
  market: {
    exaQuery:
      "voluntary carbon market carbon credit price issuance retirement Verra Gold Standard registry trading carbon offset demand supply",
    promptGuide:
      "Track demand-supply and liquidity signals in carbon markets: prices, retirements, issuances, and buyer concentration.",
    category: "news",
  },
  research: {
    exaQuery:
      "enhanced weathering biochar carbon removal MRV permanence additionality soil carbon direct air capture ocean alkalinity mineralization carbon sequestration study",
    promptGuide:
      "Focus strictly on scientific papers and discoveries: peer-reviewed articles, preprints, methodological advances, and quantification breakthroughs.",
    category: "research",
  },
  customer: {
    exaQuery:
      "carbon removal offtake procurement net zero corporate buyer carbon credit purchase agreement Frontier Microsoft Stripe Shopify carbon negative commitment",
    promptGuide:
      "Track buyer-side intelligence: procurements, offtakes, purchasing criteria, and renewal/expansion behavior.",
    category: "news",
  },
  competitive: {
    exaQuery:
      "carbon removal startup CDR company launch partnership MRV platform registry marketplace enhanced weathering biochar direct air capture deployment",
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
  const start = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const end = now.toISOString();

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await scheduleExaCall();
      const response = await axios.post(
        "https://api.exa.ai/search",
        {
          query,
          type: "neural",
          category,
          numResults: 10,
          text: true,
          useAutoprompt: true,
          startPublishedDate: start,
          endPublishedDate: end,
          ...(includeDomains && includeDomains.length > 0 ? { includeDomains } : {}),
        },
        {
          headers: {
            "x-api-key": apiKey,
            "content-type": "application/json",
          },
          timeout: 25000,
        },
      );

      return (response.data?.results ?? []) as ExaResult[];
    } catch (error) {
      lastError = error;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const retryAfterHeader = axios.isAxiosError(error)
        ? error.response?.headers?.["retry-after"]
        : undefined;
      const retryAfterSeconds = Number(Array.isArray(retryAfterHeader) ? retryAfterHeader[0] : retryAfterHeader);
      if (status !== 429 || attempt === 4) break;
      const expBackoffMs = 800 * (attempt + 1) * 2;
      const retryAfterMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 0;
      const jitterMs = Math.floor(Math.random() * 250);
      const delayMs = Math.max(expBackoffMs, retryAfterMs) + jitterMs;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Exa search failed");
}

function parseRssItems(xml: string): ExaResult[] {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
  return itemBlocks.slice(0, 12).map((item) => {
    const title =
      item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ??
      item.match(/<title>(.*?)<\/title>/)?.[1] ??
      "";
    const url = item.match(/<link>(.*?)<\/link>/)?.[1] ?? "";
    const publishedDate =
      item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ??
      item.match(/<dc:date>(.*?)<\/dc:date>/)?.[1] ??
      "";
    const text =
      item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ??
      item.match(/<description>(.*?)<\/description>/)?.[1] ??
      "";
    return {
      title: title.replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
      url: url.trim(),
      publishedDate: publishedDate ? new Date(publishedDate).toISOString() : undefined,
      text: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
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
      if (!res.ok) continue;
      const xml = await res.text();
      results.push(...parseRssItems(xml));
    } catch {
      // ignore bad feed and continue
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

function fallbackFromExa(stream: IntelligenceStream, exaItems: ExaResult[]): AgentFinding[] {
  return exaItems
    .filter((x) => x.url && x.title)
    .slice(0, 6)
    .map((x) => ({
      stream,
      title: (x.title ?? "Untitled").trim(),
      summary: ((x.text ?? x.title ?? "").trim() || "No summary available.").slice(0, 420),
      entity: (x.title ?? "Market").split(" ").slice(0, 3).join(" "),
      action: "reported development",
      sourceUrl: x.url as string,
      sourceName: domainFromUrl(x.url as string),
      publishedAt: x.publishedDate,
    }));
}

export async function runSpecializedAgent(
  stream: IntelligenceStream,
): Promise<AgentFinding[]> {
  const cfg = STREAM_CONFIG[stream];
  const domains = STREAM_EXA_DOMAINS[stream];
  const exaItems = await exaSearch(cfg.exaQuery, cfg.category ?? "news", domains);
  const rssItems = await rssSearch(stream);
  const mergedMap = new Map<string, ExaResult>();
  for (const item of [...exaItems, ...rssItems]) {
    const key = item.url ? normalizeUrl(item.url) : "";
    if (!key) continue;
    if (!mergedMap.has(key)) mergedMap.set(key, item);
  }
  const combinedItems = Array.from(mergedMap.values()).slice(0, 20);
  const trustedItems = combinedItems.filter((x) => (x.url ? isTrustedSourceUrl(x.url) : false));
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
Extract only high-signal items from last 24-48 hours.
Prioritize carbon credits, CDR, MRV, policy and market infrastructure relevance.
For research stream, include only paper/discovery items and exclude market commentary.
Output strictly structured findings.
Avoid duplicates and avoid invented links.`,
      prompt: `Analyze these Exa search results and extract 4-8 high-confidence findings.
Return valid JSON only with this exact shape:
{"findings":[{"title":"...","summary":"...","entity":"...","action":"...","sourceUrl":"https://...","sourceName":"...","publishedAt":"..."}]}

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

  const mapped = findings
    .map((f) => ({
      stream,
      title: String(f.title ?? "").trim(),
      summary: String(f.summary ?? "").trim(),
      entity: String(f.entity ?? "").trim(),
      action: String(f.action ?? "").trim(),
      sourceUrl: String(f.sourceUrl ?? "").trim(),
      sourceName: String(f.sourceName ?? "").trim(),
      publishedAt: String(f.publishedAt ?? "").trim() || undefined,
    }))
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

  return mapped.length > 0 ? mapped : fallbackFromExa(stream, trustedItems);
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
