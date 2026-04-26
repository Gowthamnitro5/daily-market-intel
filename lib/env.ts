const required = [
  "AI_GATEWAY_API_KEY",
  "OPENROUTER_API_KEY",
  "EXA_API_KEY",
  "CF_API_TOKEN",
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "SLACK_CHANNEL_ID",
  "CRON_SECRET",
  "CUSTOM_MESSAGE_TOKEN",
] as const;

type RequiredEnv = (typeof required)[number];

export function getEnv(name: RequiredEnv): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function assertEnv() {
  for (const key of required) getEnv(key);
}

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
}
