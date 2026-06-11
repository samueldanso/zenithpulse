import { sql } from "drizzle-orm";
import { index, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const playbooks = sqliteTable("playbooks", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	mode: text("mode").notNull().default("observe"),
	contractJson: text("contract_json"),
	contractDerivedAt: text("contract_derived_at"),
	lastObservedAt: text("last_observed_at"),
	riskScore: real("risk_score").default(0),
	riskState: text("risk_state").default("healthy"),
	createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const traces = sqliteTable(
	"traces",
	{
		id: text("id").primaryKey(),
		cycleId: text("cycle_id").notNull(),
		playbookId: text("playbook_id")
			.notNull()
			.references(() => playbooks.id),
		timestamp: text("timestamp").notNull(),
		liveStateJson: text("live_state_json").notNull(),
		contractJson: text("contract_json").notNull().default("{}"),
		driftResultsJson: text("drift_results_json").notNull(),
		riskScore: real("risk_score").notNull(),
		riskState: text("risk_state").notNull(),
		enforcementAction: text("enforcement_action").notNull().default("none"),
		actionTarget: text("action_target"),
		actionResult: text("action_result"),
		actionError: text("action_error"),
		reasoning: text("reasoning").notNull(),
		createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
	},
	(table) => [
		index("idx_traces_playbook").on(table.playbookId, table.timestamp),
		index("idx_traces_action").on(table.enforcementAction),
	],
);
