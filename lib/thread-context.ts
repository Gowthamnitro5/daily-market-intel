import path from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import type { ThreadContext } from "./types";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dataDir = path.join(process.cwd(), ".data");
    mkdirSync(dataDir, { recursive: true });
    const file = path.join(dataDir, "market-intel.sqlite");
    _db = new Database(file);
    _db.pragma("journal_mode = WAL");

    _db.exec(`
      CREATE TABLE IF NOT EXISTS thread_contexts (
        thread_ts TEXT PRIMARY KEY,
        briefing TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  return _db;
}

export async function setThreadContext(threadTs: string, context: ThreadContext) {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO thread_contexts (thread_ts, briefing, created_at)
     VALUES (?, ?, ?)`,
  ).run(threadTs, context.briefing, context.createdAt);
}

export async function getThreadContext(threadTs: string): Promise<ThreadContext | null> {
  const db = getDb();
  const row = db.prepare(
    "SELECT briefing, created_at FROM thread_contexts WHERE thread_ts = ? LIMIT 1",
  ).get(threadTs) as { briefing: string; created_at: string } | undefined;
  if (!row) return null;
  return { briefing: row.briefing, createdAt: row.created_at };
}
