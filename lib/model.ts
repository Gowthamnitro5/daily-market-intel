import { createGateway } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import { getOpenRouterModel } from "./env";

let _gateway: ReturnType<typeof createGateway> | null = null;
let _openrouter: ReturnType<typeof createOpenAI> | null = null;

function gateway() {
  if (!_gateway) {
    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) throw new Error("Missing AI_GATEWAY_API_KEY");
    _gateway = createGateway({
      apiKey,
      baseURL: "https://ai-gateway.vercel.sh/v1/ai",
    });
  }
  return _gateway;
}

function openrouter() {
  if (!_openrouter) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_API_KEY");
    _openrouter = createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
  return _openrouter;
}

/** Claude Sonnet 4.6 via Vercel AI Gateway — used for TL;DR and thread Q&A. */
export function smartModel() {
  return gateway()("anthropic/claude-sonnet-4-6-20250514");
}

/** Free OpenRouter model — used for bulk agent extraction (6 streams). */
export function freeModel() {
  return openrouter()(getOpenRouterModel());
}
