import { NextResponse } from "next/server";
import { runDailyWorkflow } from "@/lib/workflow";
import { postMessage } from "@/lib/slack";
import { getEnv } from "@/lib/env";

async function handleCron(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${getEnv("CRON_SECRET")}`;
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";

    if (authHeader !== expected && !isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runDailyWorkflow();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Alert the team in Slack when the pipeline fails.
    try {
      await postMessage(`[Pipeline Error] Daily intelligence run failed: ${message}`);
    } catch {
      // If Slack itself is down, we can only log.
      console.error("Failed to send pipeline error alert to Slack:", message);
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return handleCron(req);
}

export async function GET(req: Request) {
  return handleCron(req);
}
