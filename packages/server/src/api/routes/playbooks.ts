import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppConfig } from "../../config.js";
import type { getDb } from "../../db/client.js";
import * as schema from "../../db/schema.js";

type Db = ReturnType<typeof getDb>;

const modeSchema = z.object({
	mode: z.enum(["observe", "enforce", "silent"]),
});

export function createPlaybookRoutes(db: Db, config: AppConfig) {
	const app = new Hono();

	app.get("/", (c) => {
		const rows = db.select().from(schema.playbooks).all();
		const result = rows.map((row) => ({
			id: row.id,
			name: row.name,
			displayName: row.name,
			status: "active",
			executionMode: row.mode,
			riskScore: row.riskScore,
			riskState: row.riskState,
			lastObservedAt: row.lastObservedAt,
		}));
		return c.json(result);
	});

	app.get("/:id", (c) => {
		const id = c.req.param("id");
		const row = db.select().from(schema.playbooks).where(eq(schema.playbooks.id, id)).get();

		if (!row) {
			return c.json({ error: "Playbook not found" }, 404);
		}

		const contract = row.contractJson ? JSON.parse(row.contractJson) : null;

		return c.json({
			id: row.id,
			name: row.name,
			displayName: row.name,
			status: "active",
			executionMode: row.mode,
			riskScore: row.riskScore,
			riskState: row.riskState,
			lastObservedAt: row.lastObservedAt,
			contract,
		});
	});

	app.patch("/:id/mode", async (c) => {
		const id = c.req.param("id");
		const row = db.select().from(schema.playbooks).where(eq(schema.playbooks.id, id)).get();

		if (!row) {
			return c.json({ error: "Playbook not found" }, 404);
		}

		const body = await c.req.json();
		const parsed = modeSchema.safeParse(body);

		if (!parsed.success) {
			return c.json({ error: "Invalid mode. Must be observe, enforce, or silent" }, 400);
		}

		db.update(schema.playbooks)
			.set({ mode: parsed.data.mode })
			.where(eq(schema.playbooks.id, id))
			.run();

		config.MODE_DEFAULT = parsed.data.mode;

		return c.json({ id, mode: parsed.data.mode });
	});

	return app;
}
