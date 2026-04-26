import { d1Query, d1Execute } from "./d1-client";
import type { ThreadContext } from "./types";

export async function setThreadContext(threadTs: string, context: ThreadContext) {
  await d1Execute(
    `INSERT OR REPLACE INTO thread_contexts (thread_ts, briefing, created_at)
     VALUES (?, ?, ?)`,
    [threadTs, context.briefing, context.createdAt],
  );
}

export async function getThreadContext(threadTs: string): Promise<ThreadContext | null> {
  const result = await d1Query(
    "SELECT briefing, created_at FROM thread_contexts WHERE thread_ts = ? LIMIT 1",
    [threadTs],
  );
  if (!result.results.length) return null;
  const row = result.results[0];
  return {
    briefing: row.briefing as string,
    createdAt: row.created_at as string,
  };
}
