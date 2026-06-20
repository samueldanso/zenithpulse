console.log = (...args: unknown[]) => process.stderr.write(`${args.join(" ")}\n`);
console.info = (...args: unknown[]) => process.stderr.write(`${args.join(" ")}\n`);

import { loadConfig } from "./config.js";
import { getDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { startMcpServer } from "./mcp/server.js";

process.on("uncaughtException", (err) => {
	process.stderr.write(`[mcp] uncaughtException: ${err.message}\n`);
	process.exit(1);
});

const config = loadConfig();
await runMigrations(config.DB_PATH);
const db = getDb(config.DB_PATH);

await startMcpServer(db);
