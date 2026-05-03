/**
 * Shared pipeline execution lock.
 * Prevents concurrent runs from both the internal cron scheduler
 * and the /api/cron HTTP endpoint.
 */

let running = false;
let runId: string | null = null;
let startedAt: string | null = null;

export function isPipelineRunning() {
  return running;
}

export function getPipelineState() {
  return { running, runId, startedAt };
}

export function acquireLock(id: string): boolean {
  if (running) return false;
  running = true;
  runId = id;
  startedAt = new Date().toISOString();
  return true;
}

export function releaseLock() {
  running = false;
  runId = null;
  startedAt = null;
}
