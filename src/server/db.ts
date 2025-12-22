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
  theme: string | null;
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
    theme TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
).run();

db.prepare(
  `CREATE TABLE IF NOT EXISTS saved_filters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    team_id TEXT,
    filters JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
).run();

export type SavedFilterPreset = {
  id: string;
  name: string;
  teamId: string | null;
  filters: SavedFilters;
  createdAt: string;
};

const appStateColumns = db.prepare(`PRAGMA table_info(app_state)`).all() as { name: string }[];
if (!appStateColumns.some((col) => col.name === 'theme')) {
  db.prepare(`ALTER TABLE app_state ADD COLUMN theme TEXT`).run();
}

db.prepare(
  `INSERT INTO app_state (id, last_project, filters, theme)
   SELECT 1, NULL, NULL, NULL
   WHERE NOT EXISTS (SELECT 1 FROM app_state WHERE id = 1)`,
).run();

export function getAppState(): { lastProject: string | null; filters: SavedFilters | null; theme: string | null } {
  const row = db.prepare('SELECT * FROM app_state WHERE id = 1').get() as AppStateRow;
  return {
    lastProject: row?.last_project ?? null,
    filters: row?.filters ? (JSON.parse(row.filters) as SavedFilters) : null,
    theme: row?.theme ?? null,
  };
}

export function saveAppState(lastProject: string | null, filters: SavedFilters | null) {
  db.prepare(
    `UPDATE app_state SET last_project = @lastProject, filters = @filters, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
  ).run({ lastProject, filters: filters ? JSON.stringify(filters) : null });
}

export function saveTheme(theme: string | null) {
  db.prepare(`UPDATE app_state SET theme = @theme, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run({ theme });
}

export function listSavedFilters(): SavedFilterPreset[] {
  const rows = db.prepare('SELECT * FROM saved_filters ORDER BY created_at DESC').all() as {
    id: string;
    name: string;
    team_id: string | null;
    filters: string;
    created_at: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    teamId: row.team_id,
    filters: JSON.parse(row.filters) as SavedFilters,
    createdAt: row.created_at,
  }));
}

export function createSavedFilter(preset: { id: string; name: string; teamId: string | null; filters: SavedFilters }) {
  db.prepare(
    `INSERT INTO saved_filters (id, name, team_id, filters)
     VALUES (@id, @name, @teamId, @filters)`,
  ).run({
    id: preset.id,
    name: preset.name,
    teamId: preset.teamId,
    filters: JSON.stringify(preset.filters),
  });
}

export function updateSavedFilter(preset: { id: string; name: string; teamId: string | null; filters: SavedFilters }) {
  db.prepare(
    `UPDATE saved_filters SET name = @name, team_id = @teamId, filters = @filters WHERE id = @id`,
  ).run({
    id: preset.id,
    name: preset.name,
    teamId: preset.teamId,
    filters: JSON.stringify(preset.filters),
  });
}

export function deleteSavedFilter(id: string) {
  db.prepare('DELETE FROM saved_filters WHERE id = ?').run(id);
}
