import { Hono } from "hono";
import { routes } from "./api/routes.js";
import { loadConfig } from "./config.js";
import { runMigrations } from "./db/migrate.js";

const config = loadConfig();

await runMigrations(config.DB_PATH);

const app = new Hono();
app.route("/", routes);

export default {
	port: config.PORT,
	fetch: app.fetch,
};

console.log(`[server] ZenithPulse running on port ${config.PORT}`);
