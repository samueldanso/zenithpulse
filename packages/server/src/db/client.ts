import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.js";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(dbPath: string): ReturnType<typeof drizzle<typeof schema>> {
	if (!db) {
		const sqlite = new Database(dbPath, { create: true });
		sqlite.exec("PRAGMA journal_mode = WAL;");
		sqlite.exec("PRAGMA foreign_keys = ON;");
		db = drizzle(sqlite, { schema });
	}
	return db;
}
