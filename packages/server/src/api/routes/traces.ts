import { count } from "drizzle-orm";
import { Hono } from "hono";
import type { getDb } from "../../db/client.js";
import * as schema from "../../db/schema.js";
import { getTrace, listTraces } from "../../trace/store.js";

type Db = ReturnType<typeof getDb>;

export function createTraceRoutes(db: Db) {
	const app = new Hono();

	app.get("/", (c) => {
		const playbookId = c.req.query("playbook_id");
		const action = c.req.query("action");
		const limitParam = Number(c.req.query("limit") || "50");
		const offsetParam = Number(c.req.query("offset") || "0");

		const limit = Math.min(Math.max(limitParam, 1), 200);
		const offset = Math.max(offsetParam, 0);

		const data = listTraces(db, { playbookId, limit, offset, action });

		const totalResult = db.select({ value: count() }).from(schema.traces).get();
		const total = totalResult?.value ?? 0;

		return c.json({ data, total, limit, offset });
	});

	app.get("/:id", (c) => {
		const id = c.req.param("id");
		const trace = getTrace(db, id);

		if (!trace) {
			return c.json({ error: "Trace not found" }, 404);
		}

		return c.json(trace);
	});

	return app;
}
