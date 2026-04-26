import { createOpenAI } from "@ai-sdk/openai";
import { getEnv, getOpenRouterModel } from "./env";

const openrouter = createOpenAI({
  apiKey: getEnv("OPENROUTER_API_KEY"),
  baseURL: "https://openrouter.ai/api/v1",
});

export function freeModel() {
  return openrouter(getOpenRouterModel());
}
