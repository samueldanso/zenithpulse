import type { DecisionTrace } from "@zenithpulse/shared";
import { and, desc, eq } from "drizzle-orm";
import type { getDb } from "../db/client.js";
import * as schema from "../db/schema.js";

type Db = ReturnType<typeof getDb>;

export function saveTrace(db: Db, trace: DecisionTrace): void {
	db.insert(schema.traces)
		.values({
			id: trace.id,
			cycleId: trace.cycleId,
			playbookId: trace.playbookId,
			timestamp: trace.timestamp,
			liveStateJson: JSON.stringify(trace.liveStateSnapshot),
			driftResultsJson: JSON.stringify(trace.driftResults),
			riskScore: trace.riskScore,
			riskState: trace.riskState,
			enforcementAction: trace.enforcementAction,
			actionTarget: trace.actionTarget ?? null,
			actionResult: trace.actionResult ?? null,
			actionError: trace.actionError ?? null,
			reasoning: trace.reasoning,
		})
		.run();
}

interface ListTracesOpts {
	playbookId?: string;
	limit?: number;
	offset?: number;
	action?: string;
}

export function listTraces(db: Db, opts: ListTracesOpts = {}): DecisionTrace[] {
	const { playbookId, limit = 50, offset = 0, action } = opts;

	const conditions = [];
	if (playbookId) conditions.push(eq(schema.traces.playbookId, playbookId));
	if (action) conditions.push(eq(schema.traces.enforcementAction, action));

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = db
		.select()
		.from(schema.traces)
		.where(where)
		.orderBy(desc(schema.traces.timestamp))
		.limit(limit)
		.offset(offset)
		.all();

	return rows.map(rowToTrace);
}

export function getTrace(db: Db, id: string): DecisionTrace | null {
	const row = db.select().from(schema.traces).where(eq(schema.traces.id, id)).get();
	if (!row) return null;
	return rowToTrace(row);
}

function rowToTrace(row: typeof schema.traces.$inferSelect): DecisionTrace {
	return {
		id: row.id,
		cycleId: row.cycleId,
		playbookId: row.playbookId,
		timestamp: row.timestamp,
		liveStateSnapshot: JSON.parse(row.liveStateJson),
		contractSnapshot: { playbookId: row.playbookId } as DecisionTrace["contractSnapshot"],
		driftResults: JSON.parse(row.driftResultsJson),
		riskScore: row.riskScore,
		riskState: row.riskState as DecisionTrace["riskState"],
		enforcementAction: row.enforcementAction as DecisionTrace["enforcementAction"],
		actionTarget: row.actionTarget ?? undefined,
		actionResult: (row.actionResult as DecisionTrace["actionResult"]) ?? undefined,
		actionError: row.actionError ?? undefined,
		reasoning: row.reasoning,
	};
}
