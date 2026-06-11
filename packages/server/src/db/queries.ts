import { desc, eq } from "drizzle-orm";
import type { getDb } from "./client.js";
import * as schema from "./schema.js";

type Db = ReturnType<typeof getDb>;

export function updatePlaybookRiskState(
	db: Db,
	playbookId: string,
	riskScore: number,
	riskState: string,
): void {
	db.update(schema.playbooks)
		.set({ riskScore, riskState })
		.where(eq(schema.playbooks.id, playbookId))
		.run();
}

export function getRecentTraces(db: Db, playbookId?: string, limit = 20) {
	const query = db
		.select({
			id: schema.traces.id,
			cycleId: schema.traces.cycleId,
			playbookId: schema.traces.playbookId,
			timestamp: schema.traces.timestamp,
			riskScore: schema.traces.riskScore,
			riskState: schema.traces.riskState,
			enforcementAction: schema.traces.enforcementAction,
			actionTarget: schema.traces.actionTarget,
			actionResult: schema.traces.actionResult,
			reasoning: schema.traces.reasoning,
			createdAt: schema.traces.createdAt,
		})
		.from(schema.traces);

	const filtered = playbookId ? query.where(eq(schema.traces.playbookId, playbookId)) : query;

	return filtered.orderBy(desc(schema.traces.timestamp)).limit(limit).all();
}
