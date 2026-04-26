CREATE TABLE IF NOT EXISTS published_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  stream TEXT NOT NULL,
  source_published_date TEXT,
  first_slack_published_at TEXT NOT NULL,
  first_slack_thread_ts TEXT
);

CREATE INDEX IF NOT EXISTS idx_published_items_source_published_date
ON published_items (source_published_date);

CREATE TABLE IF NOT EXISTS seen_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key TEXT NOT NULL UNIQUE,
  latest_text TEXT NOT NULL,
  last_source_published_date TEXT,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS thread_contexts (
  thread_ts TEXT PRIMARY KEY,
  briefing TEXT NOT NULL,
  created_at TEXT NOT NULL
);
