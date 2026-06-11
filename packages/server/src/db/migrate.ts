import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const MIGRATIONS = [
	`CREATE TABLE IF NOT EXISTS playbooks (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		mode TEXT NOT NULL DEFAULT 'observe',
		contract_json TEXT,
		contract_derived_at TEXT,
		last_observed_at TEXT,
		risk_score REAL DEFAULT 0,
		risk_state TEXT DEFAULT 'healthy',
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);`,
	`CREATE TABLE IF NOT EXISTS traces (
		id TEXT PRIMARY KEY,
		cycle_id TEXT NOT NULL,
		playbook_id TEXT NOT NULL REFERENCES playbooks(id),
		timestamp TEXT NOT NULL,
		live_state_json TEXT NOT NULL,
		contract_json TEXT NOT NULL DEFAULT '{}',
		drift_results_json TEXT NOT NULL,
		risk_score REAL NOT NULL,
		risk_state TEXT NOT NULL,
		enforcement_action TEXT NOT NULL DEFAULT 'none',
		action_target TEXT,
		action_result TEXT,
		action_error TEXT,
		reasoning TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);`,
	"CREATE INDEX IF NOT EXISTS idx_traces_playbook ON traces(playbook_id, timestamp DESC);",
	"CREATE INDEX IF NOT EXISTS idx_traces_action ON traces(enforcement_action) WHERE enforcement_action != 'none';",
];

export async function runMigrations(dbPath: string): Promise<void> {
	mkdirSync(dirname(dbPath), { recursive: true });
	const sqlite = new Database(dbPath, { create: true });
	sqlite.exec("PRAGMA journal_mode = WAL;");
	sqlite.exec("PRAGMA foreign_keys = ON;");

	for (const migration of MIGRATIONS) {
		sqlite.exec(migration);
	}

	sqlite.close();
	console.log("[db] Migrations complete");
}
