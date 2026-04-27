import { NextResponse } from "next/server";
import axios from "axios";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const tavilyResult = await checkTavily();
  const exaResult = await checkExa();
  return NextResponse.json({ tavily: tavilyResult, exa: exaResult });
}

async function checkTavily() {
  try {
    const apiKey = getEnv("TAVILY_API_KEY");
    const start = Date.now();
    const res = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: apiKey,
        query: "carbon credit market",
        search_depth: "basic",
        topic: "news",
        max_results: 3,
      },
      { timeout: 15000 },
    );
    return {
      status: "healthy" as const,
      responseTime: Date.now() - start,
      resultCount: res.data?.results?.length ?? 0,
      sampleResults: (res.data?.results ?? [])
        .slice(0, 3)
        .map((r: { title?: string; url?: string }) => ({
          title: r.title ?? "",
          url: r.url ?? "",
        })),
    };
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    return {
      status: "error" as const,
      responseTime: 0,
      resultCount: 0,
      sampleResults: [],
      error:
        status === 432
          ? "Quota exceeded"
          : `HTTP ${status ?? "unknown"}`,
    };
  }
}

async function checkExa() {
  try {
    const apiKey = getEnv("EXA_API_KEY");
    const start = Date.now();
    const now = new Date();
    const oneDayAgo = new Date(
      now.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString();
    const res = await axios.post(
      "https://api.exa.ai/search",
      {
        query: "carbon credit",
        type: "neural",
        category: "news",
        numResults: 3,
        text: true,
        startPublishedDate: oneDayAgo,
        endPublishedDate: now.toISOString(),
      },
      {
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        timeout: 15000,
      },
    );
    return {
      status: "healthy" as const,
      responseTime: Date.now() - start,
      resultCount: res.data?.results?.length ?? 0,
      sampleResults: (res.data?.results ?? [])
        .slice(0, 3)
        .map((r: { title?: string; url?: string }) => ({
          title: r.title ?? "",
          url: r.url ?? "",
        })),
    };
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    return {
      status: "error" as const,
      responseTime: 0,
      resultCount: 0,
      sampleResults: [],
      error: `HTTP ${status ?? "unknown"}`,
    };
  }
}
