import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { count } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppConfig } from "../config.js";
import type { getDb } from "../db/client.js";
import * as schema from "../db/schema.js";
import type { McpRuntimeState } from "../mcp/tools.js";
import { registerTools } from "../mcp/tools.js";
import { lastCycleAt, observerRunning } from "../observer/loop.js";
import { createEventRoutes } from "./events.js";
import { createPlaybookRoutes } from "./playbooks.js";
import { createTraceRoutes } from "./traces.js";

type Db = ReturnType<typeof getDb>;

const startTime = Date.now();

const SKILL_FILE_PATH = resolve(process.cwd(), "SKILL.md");

export function createRoutes(db: Db, config: AppConfig, runtimeState?: McpRuntimeState) {
	const app = new Hono();

	const allowedOrigins = config.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

	app.use(
		"/api/*",
		cors({
			origin: allowedOrigins,
			allowMethods: ["GET", "POST", "PATCH"],
			allowHeaders: ["Content-Type"],
		}),
	);

	app.use(
		"/mcp",
		cors({
			origin: "*",
			allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type", "mcp-session-id", "Last-Event-ID", "mcp-protocol-version"],
			exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
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

	app.route("/api/playbooks", createPlaybookRoutes(db));
	app.route("/api/traces", createTraceRoutes(db));
	app.route("/api/events", createEventRoutes());

	app.get("/skill.md", (c) => {
		try {
			const content = readFileSync(SKILL_FILE_PATH, "utf-8");
			return c.text(content, 200, { "Content-Type": "text/markdown; charset=utf-8" });
		} catch {
			return c.text("# SKILL.md not found", 404);
		}
	});

	const state: McpRuntimeState = runtimeState ?? {
		getObserverRunning: () => false,
		getLastCycleAt: () => null,
	};

	app.all("/mcp", async (c) => {
		const transport = new WebStandardStreamableHTTPServerTransport();
		const server = new McpServer({ name: "zenithpulse", version: "1.0.0" });
		registerTools(server, db, state);
		await server.connect(transport);
		return transport.handleRequest(c.req.raw);
	});

	return app;
}
