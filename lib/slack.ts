import crypto from "node:crypto";
import { WebClient } from "@slack/web-api";
import { getEnv } from "./env";

const slack = () => new WebClient(getEnv("SLACK_BOT_TOKEN"));

type PostMessageOptions = {
  threadTs?: string;
  unfurlLinks?: boolean;
  unfurlMedia?: boolean;
};

export async function postMessage(
  text: string,
  channel?: string,
  options?: PostMessageOptions,
) {
  const client = slack();
  const result = await client.chat.postMessage({
    channel: channel ?? getEnv("SLACK_CHANNEL_ID"),
    text,
    mrkdwn: true,
    thread_ts: options?.threadTs,
    unfurl_links: options?.unfurlLinks ?? false,
    unfurl_media: options?.unfurlMedia ?? false,
  });

  return result.ts ?? null;
}

export function verifySlackSignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  if (!timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  // 5 minute replay window.
  if (Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false;

  const signingSecret = getEnv("SLACK_SIGNING_SECRET");
  const base = `v0:${timestamp}:${rawBody}`;
  const digest = crypto.createHmac("sha256", signingSecret).update(base).digest("hex");
  const expected = `v0=${digest}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
