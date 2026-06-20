import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import type { getDb } from "../db/client.js";
import * as schema from "../db/schema.js";
import { listTraces } from "../trace/store.js";

type Db = ReturnType<typeof getDb>;

const startTime = Date.now();

export interface McpRuntimeState {
	getObserverRunning: () => boolean;
	getLastCycleAt: () => string | null;
}

const DEFAULT_RUNTIME_STATE: McpRuntimeState = {
	getObserverRunning: () => false,
	getLastCycleAt: () => null,
};

export function registerTools(server: McpServer, db: Db, runtimeState?: McpRuntimeState): void {
	const state = runtimeState ?? DEFAULT_RUNTIME_STATE;
	server.tool("list_playbooks", "List all monitored playbooks with risk state", {}, () => {
		const rows = db.select().from(schema.playbooks).all();
		const result = rows.map((row) => ({
			id: row.id,
			name: row.name,
			risk_score: row.riskScore,
			risk_state: row.riskState,
			mode: row.mode,
		}));
		return { content: [{ type: "text", text: JSON.stringify(result) }] };
	});

	server.tool(
		"get_risk_state",
		"Get current risk score, drift results, and last cycle time for a playbook",
		{ playbook_id: z.string().describe("The playbook strategy ID") },
		({ playbook_id }) => {
			const row = db
				.select()
				.from(schema.playbooks)
				.where(eq(schema.playbooks.id, playbook_id))
				.get();

			if (!row) {
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "Playbook not found" }) }],
				};
			}

			const traces = listTraces(db, { playbookId: playbook_id, limit: 1 });
			const lastTrace = traces[0] ?? null;

			const result = {
				playbook_id: row.id,
				risk_score: row.riskScore,
				risk_state: row.riskState,
				mode: row.mode,
				last_cycle_at: row.lastObservedAt,
				drift_results: lastTrace?.driftResults ?? [],
			};
			return { content: [{ type: "text", text: JSON.stringify(result) }] };
		},
	);

	server.tool(
		"get_traces",
		"Get recent decision traces for a playbook",
		{
			playbook_id: z.string().describe("The playbook strategy ID"),
			limit: z.number().optional().default(10).describe("Number of traces to return (max 100)"),
			action: z
				.string()
				.optional()
				.describe("Filter by enforcement action (none, cancel_order, close_position)"),
		},
		({ playbook_id, limit, action }) => {
			const capped = Math.min(Math.max(limit, 1), 100);
			const traces = listTraces(db, { playbookId: playbook_id, limit: capped, action });
			const result = traces.map((t) => ({
				id: t.id,
				timestamp: t.timestamp,
				risk_score: t.riskScore,
				risk_state: t.riskState,
				enforcement_action: t.enforcementAction,
				action_target: t.actionTarget,
				action_result: t.actionResult,
				reasoning: t.reasoning,
			}));
			return { content: [{ type: "text", text: JSON.stringify(result) }] };
		},
	);

	server.tool(
		"switch_mode",
		"Change operating mode for a playbook (enforce, observe, or silent)",
		{
			playbook_id: z.string().describe("The playbook strategy ID"),
			mode: z.enum(["enforce", "observe", "silent"]).describe("The new operating mode"),
		},
		({ playbook_id, mode }) => {
			const row = db
				.select()
				.from(schema.playbooks)
				.where(eq(schema.playbooks.id, playbook_id))
				.get();

			if (!row) {
				return {
					content: [{ type: "text", text: JSON.stringify({ error: "Playbook not found" }) }],
				};
			}

			db.update(schema.playbooks).set({ mode }).where(eq(schema.playbooks.id, playbook_id)).run();

			return {
				content: [
					{ type: "text", text: JSON.stringify({ playbook_id, mode, previous_mode: row.mode }) },
				],
			};
		},
	);

	server.tool("get_health", "Get server health, uptime, and observer state", {}, () => {
		const totalResult = db.select({ value: count() }).from(schema.playbooks).get();
		const playbookCount = totalResult?.value ?? 0;
		const isRunning = state.getObserverRunning();

		const result = {
			status: isRunning ? "ok" : "degraded",
			uptime_ms: Date.now() - startTime,
			observer_running: isRunning,
			last_cycle_at: state.getLastCycleAt(),
			playbook_count: playbookCount,
		};
		return { content: [{ type: "text", text: JSON.stringify(result) }] };
	});
}
