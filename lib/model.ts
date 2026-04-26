import { createOpenAI } from "@ai-sdk/openai";
import { getEnv, getOpenRouterModel } from "./env";

let _openrouter: ReturnType<typeof createOpenAI> | null = null;

function openrouter() {
  if (!_openrouter) {
    _openrouter = createOpenAI({
      apiKey: getEnv("OPENROUTER_API_KEY"),
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
  return _openrouter;
}

export function freeModel() {
  return openrouter()(getOpenRouterModel());
}
