import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

export async function runMigrations(dbPath: string): Promise<void> {
	mkdirSync(dirname(dbPath), { recursive: true });
	const sqlite = new Database(dbPath, { create: true });
	sqlite.exec("PRAGMA journal_mode = WAL;");
	sqlite.exec("PRAGMA foreign_keys = ON;");

	const db = drizzle(sqlite);
	const migrationsFolder = resolve(import.meta.dir, "../../drizzle");
	migrate(db, { migrationsFolder });

	try {
		sqlite.exec("ALTER TABLE playbooks ADD COLUMN peak_balance REAL DEFAULT 0");
	} catch (_) {
		// Column already exists
	}

	sqlite.close();
	console.log("[db] Migrations complete");
}
