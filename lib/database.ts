import path from "node:path";
import { mkdir } from "node:fs/promises";
import sqlite3 from "sqlite3";
import { open, type Database } from "sqlite";
import type { AgentFinding } from "./types";

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

      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_published_items_source_published_date
        ON published_items (source_published_date);
      `);

      await db.exec(`
        CREATE TABLE IF NOT EXISTS seen_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_key TEXT NOT NULL UNIQUE,
          latest_text TEXT NOT NULL,
          last_source_published_date TEXT,
          last_seen_at TEXT NOT NULL
        );
      `);

      return db;
    })();
  }

  return dbPromise;
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
  const db = await getDb();
  const filtered: AgentFinding[] = [];

  for (const finding of findings) {
    if (!isFreshWithinHours(finding.publishedAt, maxAgeHours)) continue;

    const key = eventKey(finding);
    const currentText = `${finding.title} ${finding.summary}`;
    const row = await db.get<{ latest_text: string }>(
      "SELECT latest_text FROM seen_events WHERE event_key = ? LIMIT 1",
      key,
    );

    if (!row) {
      filtered.push(finding);
      continue;
    }

    // If a source republishes the same event later, skip unless meaningfully new.
    const score = similarity(currentText, row.latest_text);
    if (score < 0.72) {
      filtered.push(finding);
    }
  }

  return filtered;
}

export async function markEventsSeen(findings: AgentFinding[]) {
  if (findings.length === 0) return 0;
  const db = await getDb();
  const now = new Date().toISOString();
  let affected = 0;

  for (const finding of findings) {
    const key = eventKey(finding);
    const latestText = `${finding.title} ${finding.summary}`.slice(0, 2000);
    const result = await db.run(
      `INSERT INTO seen_events (event_key, latest_text, last_source_published_date, last_seen_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(event_key) DO UPDATE SET
         latest_text = excluded.latest_text,
         last_source_published_date = excluded.last_source_published_date,
         last_seen_at = excluded.last_seen_at`,
      key,
      latestText,
      finding.publishedAt ?? "",
      now,
    );
    affected += result.changes ?? 0;
  }

  return affected;
}

export async function filterUnpublished(findings: AgentFinding[]): Promise<AgentFinding[]> {
  const db = await getDb();
  if (findings.length === 0) return [];

  const unseen: AgentFinding[] = [];
  for (const finding of findings) {
    const row = await db.get<{ source_url: string }>(
      "SELECT source_url FROM published_items WHERE source_url = ? LIMIT 1",
      finding.sourceUrl,
    );
    if (!row) unseen.push(finding);
  }
  return unseen;
}

export async function savePublished(findings: AgentFinding[], threadTs: string | null) {
  if (!threadTs || findings.length === 0) return 0;
  const db = await getDb();
  const now = new Date().toISOString();

  let inserted = 0;
  for (const finding of findings) {
    const result = await db.run(
      `INSERT OR IGNORE INTO published_items
       (source_url, title, stream, source_published_date, first_slack_published_at, first_slack_thread_ts)
       VALUES (?, ?, ?, ?, ?, ?)`,
      finding.sourceUrl,
      finding.title,
      finding.stream,
      finding.publishedAt ?? "",
      now,
      threadTs,
    );
    inserted += result.changes ?? 0;
  }
  await markEventsSeen(findings);
  return inserted;
}
