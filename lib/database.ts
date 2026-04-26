import path from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import type { AgentFinding } from "./types";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dataDir = path.join(process.cwd(), ".data");
    mkdirSync(dataDir, { recursive: true });
    const file = path.join(dataDir, "market-intel.sqlite");
    _db = new Database(file);
    _db.pragma("journal_mode = WAL");

    _db.exec(`
      CREATE TABLE IF NOT EXISTS published_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        stream TEXT NOT NULL,
        source_published_date TEXT,
        first_slack_published_at TEXT NOT NULL,
        first_slack_thread_ts TEXT
      );
    `);

    _db.exec(`
      CREATE INDEX IF NOT EXISTS idx_published_items_source_published_date
      ON published_items (source_published_date);
    `);

    _db.exec(`
      CREATE TABLE IF NOT EXISTS seen_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        latest_text TEXT NOT NULL,
        last_source_published_date TEXT,
        last_seen_at TEXT NOT NULL
      );
    `);

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

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function eventKey(finding: AgentFinding) {
  const entity = normalizeText(finding.entity);
  const action = normalizeText(finding.action);
  if (entity && action) return `${entity}::${action}`;
  return normalizeText(finding.title);
}

function similarity(a: string, b: string) {
  const aSet = new Set(normalizeText(a).split(" ").filter(Boolean));
  const bSet = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (aSet.size === 0 || bSet.size === 0) return 0;
  let inter = 0;
  for (const token of aSet) {
    if (bSet.has(token)) inter += 1;
  }
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : inter / union;
}

function isFreshWithinHours(publishedAt: string | undefined, maxAgeHours: number) {
  if (!publishedAt) return false;
  const ts = Date.parse(publishedAt);
  if (Number.isNaN(ts)) return false;
  const ageMs = Date.now() - ts;
  return ageMs >= 0 && ageMs <= maxAgeHours * 60 * 60 * 1000;
}

export async function filterFreshAndNovel(
  findings: AgentFinding[],
  maxAgeHours = 48,
): Promise<AgentFinding[]> {
  const db = getDb();
  const stmt = db.prepare("SELECT latest_text FROM seen_events WHERE event_key = ? LIMIT 1");
  const filtered: AgentFinding[] = [];

  for (const finding of findings) {
    if (!isFreshWithinHours(finding.publishedAt, maxAgeHours)) continue;

    const key = eventKey(finding);
    const currentText = `${finding.title} ${finding.summary}`;
    const row = stmt.get(key) as { latest_text: string } | undefined;

    if (!row) {
      filtered.push(finding);
      continue;
    }

    const score = similarity(currentText, row.latest_text);
    if (score < 0.72) {
      filtered.push(finding);
    }
  }

  return filtered;
}

export async function markEventsSeen(findings: AgentFinding[]) {
  if (findings.length === 0) return 0;
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO seen_events (event_key, latest_text, last_source_published_date, last_seen_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(event_key) DO UPDATE SET
       latest_text = excluded.latest_text,
       last_source_published_date = excluded.last_source_published_date,
       last_seen_at = excluded.last_seen_at`,
  );

  let affected = 0;
  for (const finding of findings) {
    const key = eventKey(finding);
    const latestText = `${finding.title} ${finding.summary}`.slice(0, 2000);
    const result = stmt.run(key, latestText, finding.publishedAt ?? "", now);
    affected += result.changes;
  }

  return affected;
}

export async function filterUnpublished(findings: AgentFinding[]): Promise<AgentFinding[]> {
  const db = getDb();
  if (findings.length === 0) return [];
  const stmt = db.prepare("SELECT source_url FROM published_items WHERE source_url = ? LIMIT 1");

  const unseen: AgentFinding[] = [];
  for (const finding of findings) {
    const row = stmt.get(finding.sourceUrl);
    if (!row) unseen.push(finding);
  }
  return unseen;
}

export async function savePublished(findings: AgentFinding[], threadTs: string | null) {
  if (!threadTs || findings.length === 0) return 0;
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO published_items
     (source_url, title, stream, source_published_date, first_slack_published_at, first_slack_thread_ts)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  let inserted = 0;
  for (const finding of findings) {
    const result = stmt.run(
      finding.sourceUrl,
      finding.title,
      finding.stream,
      finding.publishedAt ?? "",
      now,
      threadTs,
    );
    inserted += result.changes;
  }
  await markEventsSeen(findings);
  return inserted;
}
