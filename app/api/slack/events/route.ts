import { NextResponse } from "next/server";
import { verifySlackSignature, postMessage } from "@/lib/slack";
import { getThreadContext } from "@/lib/thread-context";
import { answerThreadQuestion } from "@/lib/llm";

type SlackEventPayload = {
  challenge?: string;
  event?: {
    type?: string;
    channel?: string;
    thread_ts?: string;
    text?: string;
    bot_id?: string;
  };
};

export async function POST(req: Request) {
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp");
  const signature = req.headers.get("x-slack-signature");

  // Slack retries on slow responses — acknowledge retries immediately to prevent duplicate replies.
  const retryNum = req.headers.get("x-slack-retry-num");
  if (retryNum) {
    return NextResponse.json({ ok: true });
  }

  const parsed = JSON.parse(rawBody) as SlackEventPayload;

  if (parsed.challenge) {
    return new NextResponse(parsed.challenge, { status: 200 });
  }

  const valid = verifySlackSignature(rawBody, timestamp, signature);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = parsed.event;
  if (!event || event.type !== "message" || !event.thread_ts || !event.text || event.bot_id) {
    return NextResponse.json({ ok: true });
  }

  const context = await getThreadContext(event.thread_ts);
  if (!context) {
    return NextResponse.json({ ok: true });
  }

  try {
    const answer = await answerThreadQuestion(context.briefing, event.text);
    await postMessage(answer, event.channel, { threadTs: event.thread_ts });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
