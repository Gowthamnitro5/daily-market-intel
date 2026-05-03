import { config } from "dotenv";
import path from "node:path";

export function register() {
  config({ path: path.join(process.cwd(), ".env.local"), override: true });

  // Start internal cron scheduler (server runtime only, not during build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    startCronScheduler();
  }
}

async function runPipelineSafe(trigger: string) {
  const { acquireLock, releaseLock } = await import("@/lib/pipeline-lock");

  const id = `${trigger}-${Date.now()}`;
  if (!acquireLock(id)) {
    console.log(`[Internal Cron] Pipeline already running, skipping (trigger: ${trigger})`);
    return;
  }

  try {
    console.log(`[Internal Cron] Pipeline started (id: ${id})`);
    const { runDailyWorkflow } = await import("@/lib/workflow");
    const result = await runDailyWorkflow();
    console.log(`[Internal Cron] Pipeline completed:`, JSON.stringify(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Internal Cron] Pipeline failed:`, message);
    try {
      const { postMessage } = await import("@/lib/slack");
      await postMessage(`[Pipeline Error] ${trigger} run failed: ${message}`);
    } catch {
      // Slack unreachable
    }
  } finally {
    releaseLock();
  }
}

async function hasTodayRun(): Promise<boolean> {
  try {
    const { d1Query } = await import("@/lib/d1-client");
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const result = await d1Query(
      "SELECT 1 FROM published_items WHERE first_slack_published_at >= ? LIMIT 1",
      [`${today}T00:00:00`],
    );
    return result.results.length > 0;
  } catch {
    // DB unreachable — assume not run (will attempt and fail gracefully)
    return false;
  }
}

function startCronScheduler() {
  import("node-cron").then((cron) => {
    // Daily at 8:00 AM IST (2:30 AM UTC)
    cron.schedule("30 2 * * *", () => {
      console.log(`[Internal Cron] Scheduled trigger at ${new Date().toISOString()}`);
      runPipelineSafe("scheduled");
    }, { timezone: "UTC" });

    console.log("[Internal Cron] Scheduler active — fires daily at 02:30 UTC (08:00 IST)");

    // Catch-up: if the server starts AFTER the scheduled time (e.g., redeploy at 8:05 AM IST),
    // check if today's run was missed and trigger it.
    const nowUTC = new Date();
    const minutesSinceMidnight = nowUTC.getUTCHours() * 60 + nowUTC.getUTCMinutes();
    const scheduledMinute = 2 * 60 + 30; // 2:30 UTC

    if (minutesSinceMidnight > scheduledMinute) {
      // We booted after today's scheduled time — check if run was missed
      setTimeout(async () => {
        const alreadyRan = await hasTodayRun();
        if (!alreadyRan) {
          console.log("[Internal Cron] Catch-up: today's run was missed, triggering now");
          runPipelineSafe("catch-up");
        } else {
          console.log("[Internal Cron] Catch-up: today's run already completed, skipping");
        }
      }, 15_000); // Wait 15s for server to fully boot
    }
  }).catch((err) => {
    console.error("[Internal Cron] Failed to start scheduler:", err);
  });
}
