import type { BehavioralContract, DriftResult, LiveState } from "@zenithpulse/shared";
import { eq } from "drizzle-orm";
import { eventBus } from "../api/emitter.js";
import type { BitgetClient } from "../bitget/client.js";
import type { PlaybookClient } from "../bitget/playbook-api.js";
import type { AppConfig } from "../config.js";
import { deriveContract } from "../contract/derive.js";
import { loadContract, saveContract } from "../contract/store.js";
import type { getDb } from "../db/client.js";
import { updatePlaybookRiskState } from "../db/queries.js";
import * as schema from "../db/schema.js";
import {
	detectAssetDrift,
	detectDrawdownBreach,
	detectOversize,
	detectSharpeDegradation,
} from "../drift/detect.js";
import { computeRiskScore, getRiskState } from "../drift/score.js";
import { executeEnforcement } from "../enforce/actions.js";
import { decideEnforcement } from "../enforce/engine.js";
import type { ActionResult } from "../enforce/types.js";
import { buildTrace } from "../trace/record.js";
import { saveTrace } from "../trace/store.js";
import { pollLiveState } from "./poller.js";

type Db = ReturnType<typeof getDb>;

export let observerRunning = false;
export let lastCycleAt: string | null = null;

interface ObserverState {
	timer: ReturnType<typeof setInterval> | null;
	running: boolean;
	cycleInProgress: boolean;
}

const state: ObserverState = {
	timer: null,
	running: false,
	cycleInProgress: false,
};

export function start(
	config: AppConfig,
	db: Db,
	bitgetClient: BitgetClient,
	playbookClient: PlaybookClient,
): void {
	if (state.running) return;
	state.running = true;
	observerRunning = true;

	console.log(`[observer] Starting loop — interval ${config.POLL_INTERVAL_MS}ms`);

	initializePlaybooks(db, playbookClient, config).then(() => {
		runCycle(db, bitgetClient, config);
		state.timer = setInterval(() => runCycle(db, bitgetClient, config), config.POLL_INTERVAL_MS);
	});
}

export function stop(): void {
	if (!state.running) return;
	state.running = false;
	observerRunning = false;

	if (state.timer) {
		clearInterval(state.timer);
		state.timer = null;
	}

	console.log("[observer] Stopped");
}

async function initializePlaybooks(
	db: Db,
	playbookClient: PlaybookClient,
	config: AppConfig,
): Promise<void> {
	try {
		const playbooks = await playbookClient.listPlaybooks();
		console.log(`[observer] Found ${playbooks.length} playbook(s)`);

		for (const pb of playbooks) {
			const existing = loadContract(db, pb.strategy_id);
			if (!existing) {
				const contract = deriveContract(pb.strategy_id, pb);
				saveContract(db, pb.strategy_id, pb.name, contract);
				console.log(`[observer] Derived contract for "${pb.name}"`);
			}
		}
	} catch (err) {
		console.error("[observer] Failed to initialize playbooks:", err);
	}
}

async function runCycle(db: Db, bitgetClient: BitgetClient, config: AppConfig): Promise<void> {
	if (state.cycleInProgress) {
		console.log("[observer] Skipping cycle — previous still running");
		return;
	}

	state.cycleInProgress = true;

	try {
		const liveState = await pollLiveState(bitgetClient);

		const playbooks = db.select().from(schema.playbooks).all();
		for (const pb of playbooks) {
			db.update(schema.playbooks)
				.set({ lastObservedAt: new Date().toISOString() })
				.where(eq(schema.playbooks.id, pb.id))
				.run();

			const contract = pb.contractJson ? (JSON.parse(pb.contractJson) as BehavioralContract) : null;
			if (!contract) continue;

			logCycleSummary(pb.id, liveState);

			const driftResults = runDetection(contract, liveState);
			const riskScore = computeRiskScore(contract, liveState);
			const riskState = getRiskState(riskScore);

			updatePlaybookRiskState(db, pb.id, riskScore, riskState);

			for (const drift of driftResults) {
				if (drift.result !== "pass") {
					console.log(
						`[observer] drift: ${drift.ruleId} ${drift.result} observed=${drift.observedValue} bound=${drift.contractBound}`,
					);
				}
			}

			const cycleId = crypto.randomUUID();
			const playbookMode = pb.mode || config.MODE_DEFAULT;
			const actionResults = await runEnforcement(
				playbookMode,
				driftResults,
				liveState,
				bitgetClient,
			);

			const trace = buildTrace({
				playbookId: pb.id,
				cycleId,
				liveState,
				contract,
				driftResults,
				riskScore,
				riskState,
				actionResults,
			});
			saveTrace(db, trace);
			lastCycleAt = trace.timestamp;
			console.log(`[trace] saved trace ${trace.id} — ${trace.reasoning.slice(0, 80)}`);

			eventBus.emit("cycle", {
				playbookId: pb.id,
				cycleId,
				riskScore,
				riskState,
				driftCount: driftResults.filter((d) => d.result !== "pass").length,
				timestamp: trace.timestamp,
			});

			if (trace.enforcementAction !== "none") {
				eventBus.emit("enforcement", {
					playbookId: pb.id,
					action: trace.enforcementAction,
					target: trace.actionTarget,
					result: trace.actionResult,
					timestamp: trace.timestamp,
				});
			}

			stubAlert(playbookMode, driftResults);
		}
	} catch (err) {
		console.error("[observer] Cycle error:", err);
	} finally {
		state.cycleInProgress = false;
	}
}

function logCycleSummary(playbookId: string, state: LiveState): void {
	console.log(
		`[observer] Cycle — playbook=${playbookId} balance=${state.accountBalance.toFixed(2)} exposure=${state.totalExposure.toFixed(2)} drawdown=${state.currentDrawdown.toFixed(2)}%`,
	);
}

function runDetection(contract: BehavioralContract, state: LiveState): DriftResult[] {
	return [
		detectAssetDrift(contract, state),
		detectOversize(contract, state),
		detectDrawdownBreach(contract, state),
		detectSharpeDegradation(contract, state),
	];
}

async function runEnforcement(
	mode: string,
	driftResults: DriftResult[],
	state: LiveState,
	bitgetClient: BitgetClient,
): Promise<ActionResult[]> {
	try {
		const plan = decideEnforcement(mode, driftResults, state);
		const results = await executeEnforcement(plan, bitgetClient);

		for (const r of results) {
			if (r.action.type === "none") {
				console.log(`[enforce] no action (mode: ${mode})`);
			} else if (r.success) {
				const target =
					"orderId" in r.action ? `orderId=${r.action.orderId}` : `symbol=${r.action.symbol}`;
				console.log(`[enforce] ${r.action.type} ${target} -> success`);
			} else {
				const target =
					"orderId" in r.action ? `orderId=${r.action.orderId}` : `symbol=${r.action.symbol}`;
				console.log(`[enforce] ${r.action.type} ${target} -> failed: ${r.error}`);
			}
		}

		return results;
	} catch (err) {
		console.error("[enforce] Unexpected error:", err);
		return [];
	}
}

function stubAlert(_mode: string, _driftResults: DriftResult[]): void {
	console.log("  stub: alert called");
}
