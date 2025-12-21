import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

export type SavedFilters = {
  time?: '7d' | '30d' | '90d';
  state?: string;
  type?: 'all' | 'bug' | 'feature' | 'chore';
  assigneeId?: string;
  creatorId?: string;
  cycleId?: string;
  severity?: string;
  priority?: string;
  labels?: string[];
  projectId?: string;
  startDate?: string;
  endDate?: string;
};

export type AppStateRow = {
  id: number;
  last_project: string | null;
  filters: string | null;
  updated_at: string;
};

const dbPath = path.join(process.cwd(), 'data.db');

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, '');
}

const db = new Database(dbPath);

db.prepare(
  `CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY,
    last_project TEXT,
    filters JSON,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
).run();

db.prepare(
  `INSERT INTO app_state (id, last_project, filters)
   SELECT 1, NULL, NULL
   WHERE NOT EXISTS (SELECT 1 FROM app_state WHERE id = 1)`,
).run();

export function getAppState(): { lastProject: string | null; filters: SavedFilters | null } {
  const row = db.prepare('SELECT * FROM app_state WHERE id = 1').get() as AppStateRow;
  return {
    lastProject: row?.last_project ?? null,
    filters: row?.filters ? (JSON.parse(row.filters) as SavedFilters) : null,
  };
}

export function saveAppState(lastProject: string | null, filters: SavedFilters | null) {
  db.prepare(
    `UPDATE app_state SET last_project = @lastProject, filters = @filters, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
  ).run({ lastProject, filters: filters ? JSON.stringify(filters) : null });
}
