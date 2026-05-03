import { NextResponse } from "next/server";
import { runDailyWorkflow } from "@/lib/workflow";
import { postMessage } from "@/lib/slack";
import { getEnv } from "@/lib/env";
import { acquireLock, releaseLock, getPipelineState } from "@/lib/pipeline-lock";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function runPipelineInBackground() {
  const state = getPipelineState();
  if (state.running) {
    console.log(
      `[Pipeline] Skipped duplicate trigger while run ${state.runId ?? "unknown"} is active`,
    );
    return;
  }

  const runId = `api-${Date.now()}`;
  if (!acquireLock(runId)) return;

  // Fire-and-forget: run the pipeline without blocking the HTTP response.
  runDailyWorkflow()
    .then((result) => {
      console.log(`[Pipeline ${runId}] Completed:`, JSON.stringify(result));
    })
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Pipeline ${runId}] Failed:`, message);
      try {
        await postMessage(`[Pipeline Error] Run ${runId} failed: ${message}`);
      } catch {
        console.error("Failed to send pipeline error alert to Slack:", message);
      }
    })
    .finally(() => {
      releaseLock();
    });
}

async function handleCron(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${getEnv("CRON_SECRET")}`;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";

  if (authHeader !== expected && !isVercelCron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = getPipelineState();
  if (state.running) {
    return NextResponse.json({
      ok: true,
      status: "already_running",
      runId: state.runId,
      startedAt: state.startedAt,
    });
  }

  // Return immediately; the pipeline runs in the background.
  runPipelineInBackground();
  return NextResponse.json({ ok: true, status: "pipeline_started" });
}

export async function POST(req: Request) {
  return handleCron(req);
}

export async function GET(req: Request) {
  return handleCron(req);
}
