import path from "node:path";
import { mkdir } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import type { ThreadContext } from "./types";

let dbPromise: Promise<Database> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const dataDir = path.join(process.cwd(), ".data");
      await mkdir(dataDir, { recursive: true });
      const file = path.join(dataDir, "market-intel.sqlite");
      const db = await open({
        filename: file,
        driver: sqlite3.Database,
      });

      await db.exec(`
        CREATE TABLE IF NOT EXISTS thread_contexts (
          thread_ts TEXT PRIMARY KEY,
          briefing TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      return db;
    })();
  }

  return dbPromise;
}

export async function setThreadContext(threadTs: string, context: ThreadContext) {
  const db = await getDb();
  await db.run(
    `INSERT OR REPLACE INTO thread_contexts (thread_ts, briefing, created_at)
     VALUES (?, ?, ?)`,
    threadTs,
    context.briefing,
    context.createdAt,
  );
}

export async function getThreadContext(threadTs: string): Promise<ThreadContext | null> {
  const db = await getDb();
  const row = await db.get<{ briefing: string; created_at: string }>(
    "SELECT briefing, created_at FROM thread_contexts WHERE thread_ts = ? LIMIT 1",
    threadTs,
  );
  if (!row) return null;
  return { briefing: row.briefing, createdAt: row.created_at };
}
