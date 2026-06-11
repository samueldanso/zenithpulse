import type { BehavioralContract, LiveState } from "@zenithpulse/shared";
import type { BitgetClient } from "../bitget/client.js";
import type { PlaybookClient } from "../bitget/playbook-api.js";
import type { AppConfig } from "../config.js";
import { deriveContract } from "../contract/derive.js";
import { loadContract, saveContract } from "../contract/store.js";
import type { getDb } from "../db/client.js";
import * as schema from "../db/schema.js";
import { pollLiveState } from "./poller.js";

type Db = ReturnType<typeof getDb>;

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

	console.log(`[observer] Starting loop — interval ${config.POLL_INTERVAL_MS}ms`);

	initializePlaybooks(db, playbookClient, config).then(() => {
		runCycle(db, bitgetClient, config);
		state.timer = setInterval(() => runCycle(db, bitgetClient, config), config.POLL_INTERVAL_MS);
	});
}

export function stop(): void {
	if (!state.running) return;
	state.running = false;

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
			const contract = pb.contractJson ? (JSON.parse(pb.contractJson) as BehavioralContract) : null;
			if (!contract) continue;

			logCycleSummary(pb.id, liveState);

			const driftResults = stubDetect(contract, liveState);
			const riskScore = stubScore(driftResults);
			const enforcement = stubEnforce(config.MODE_DEFAULT, driftResults);
			stubTrace(pb.id, liveState, contract, driftResults, riskScore, enforcement);
			stubAlert(config.MODE_DEFAULT, driftResults);
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

function stubDetect(_contract: BehavioralContract, _state: LiveState): unknown[] {
	console.log("  stub: detect called");
	return [];
}

function stubScore(_driftResults: unknown[]): number {
	console.log("  stub: score called");
	return 0;
}

function stubEnforce(_mode: string, _driftResults: unknown[]): string {
	console.log("  stub: enforce called");
	return "none";
}

function stubTrace(
	_playbookId: string,
	_state: LiveState,
	_contract: BehavioralContract,
	_driftResults: unknown[],
	_riskScore: number,
	_enforcement: string,
): void {
	console.log("  stub: trace called");
}

function stubAlert(_mode: string, _driftResults: unknown[]): void {
	console.log("  stub: alert called");
}
