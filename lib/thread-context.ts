import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import initSqlJs from "sql.js/dist/sql-asm.js";
import type { Database } from "sql.js";
import type { ThreadContext } from "./types";

let _db: Database | null = null;
let _dbPath: string = "";

async function getDb(): Promise<Database> {
  if (!_db) {
    const SQL = await initSqlJs();
    const isVercel = !!process.env.VERCEL;
    const dataDir = isVercel ? "/tmp" : path.join(process.cwd(), ".data");
    mkdirSync(dataDir, { recursive: true });
    _dbPath = path.join(dataDir, "market-intel.sqlite");

    if (existsSync(_dbPath)) {
      const buffer = readFileSync(_dbPath);
      _db = new SQL.Database(buffer);
    } else {
      _db = new SQL.Database();
    }

    _db.run(`
      CREATE TABLE IF NOT EXISTS thread_contexts (
        thread_ts TEXT PRIMARY KEY,
        briefing TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  return _db;
}

function saveToFile() {
  if (_db && _dbPath) {
    const data = _db.export();
    writeFileSync(_dbPath, Buffer.from(data));
  }
}

export async function setThreadContext(threadTs: string, context: ThreadContext) {
  const db = await getDb();
  db.run(
    `INSERT OR REPLACE INTO thread_contexts (thread_ts, briefing, created_at)
     VALUES (?, ?, ?)`,
    [threadTs, context.briefing, context.createdAt],
  );
  saveToFile();
}

export async function getThreadContext(threadTs: string): Promise<ThreadContext | null> {
  const db = await getDb();
  const rows = db.exec(
    "SELECT briefing, created_at FROM thread_contexts WHERE thread_ts = ? LIMIT 1",
    [threadTs],
  );
  if (!rows.length || !rows[0].values.length) return null;
  const [briefing, createdAt] = rows[0].values[0] as [string, string];
  return { briefing, createdAt };
}
