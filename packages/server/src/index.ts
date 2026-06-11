import { Hono } from "hono";
import { createRoutes } from "./api/routes.js";
import { createBitgetClient } from "./bitget/client.js";
import { createPlaybookClient } from "./bitget/playbook-api.js";
import { loadConfig } from "./config.js";
import { getDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { start as startObserver, stop as stopObserver } from "./observer/loop.js";

const config = loadConfig();

await runMigrations(config.DB_PATH);

const db = getDb(config.DB_PATH);
const bitgetClient = createBitgetClient(config);
const playbookClient = createPlaybookClient(config);

const app = new Hono();
const routes = createRoutes(db);
app.route("/", routes);

startObserver(config, db, bitgetClient, playbookClient);

function shutdown() {
	console.log("[server] Shutting down...");
	stopObserver();
	process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default {
	port: config.PORT,
	fetch: app.fetch,
};

console.log(`[server] ZenithPulse running on port ${config.PORT}`);
