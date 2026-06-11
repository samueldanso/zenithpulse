import { count } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppConfig } from "../config.js";
import type { getDb } from "../db/client.js";
import * as schema from "../db/schema.js";
import { lastCycleAt, observerRunning } from "../observer/loop.js";
import { createEventRoutes } from "./routes/events.js";
import { createPlaybookRoutes } from "./routes/playbooks.js";
import { createTraceRoutes } from "./routes/traces.js";

type Db = ReturnType<typeof getDb>;

const startTime = Date.now();

export function createRoutes(db: Db, config: AppConfig) {
	const app = new Hono();

	const allowedOrigins = process.env.ALLOWED_ORIGINS
		? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
		: ["http://localhost:3000"];

	app.use(
		"/api/*",
		cors({
			origin: allowedOrigins,
			allowMethods: ["GET", "POST", "PATCH"],
			allowHeaders: ["Content-Type"],
		}),
	);

	app.get("/api/health", (c) => {
		const totalResult = db.select({ value: count() }).from(schema.playbooks).get();
		const playbookCount = totalResult?.value ?? 0;

		return c.json({
			status: observerRunning ? "ok" : "degraded",
			uptime: Date.now() - startTime,
			lastCycleAt,
			playbookCount,
			observerRunning,
		});
	});

	app.route("/api/playbooks", createPlaybookRoutes(db, config));
	app.route("/api/traces", createTraceRoutes(db));
	app.route("/api/events", createEventRoutes());

	return app;
}
