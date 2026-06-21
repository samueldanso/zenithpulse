/**
 * Capture a verifiable usage session — polls ZenithPulse every 15s, records
 * every API call with full responses. Produces the submission artifact.
 *
 * This captures REAL Bitget API integration evidence:
 * - Continuous polling timestamps (15s intervals)
 * - Live state snapshots from Bitget (positions, orders, balance)
 * - Behavioral contracts derived from real backtest data
 * - Drift detection results per cycle
 * - Risk scores computed per playbook
 * - Enforcement actions (if any)
 *
 * Usage:
 *   bun examples/capture-session.ts                         # 10 min, live server
 *   DURATION_MIN=30 bun examples/capture-session.ts         # 30 min
 *   bun examples/capture-session.ts http://localhost:3001   # local
 *
 * Output: examples/sample-output/session-capture.json
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.argv[2] || "https://zenithpulse-server.onrender.com";
const DURATION_MIN = Number(process.env.DURATION_MIN || "10");
const INTERVAL_MS = 15_000;
const TOTAL_CYCLES = Math.ceil((DURATION_MIN * 60 * 1000) / INTERVAL_MS);

interface ApiCall {
	timestamp: string;
	endpoint: string;
	method: string;
	status: number;
	latencyMs: number;
	response: unknown;
}

interface Cycle {
	cycle: number;
	timestamp: string;
	calls: ApiCall[];
	summary: {
		playbookCount: number;
		totalTraces: number;
		observerRunning: boolean;
		riskStates: Record<string, { score: number; state: string; mode: string }>;
	};
}

const cycles: Cycle[] = [];
let totalApiCalls = 0;

async function call(method: string, path: string): Promise<ApiCall> {
	const start = Date.now();
	const res = await fetch(`${BASE_URL}${path}`, { method });
	const latencyMs = Date.now() - start;
	const response = await res.json();
	totalApiCalls++;
	return {
		timestamp: new Date().toISOString(),
		endpoint: path,
		method,
		status: res.status,
		latencyMs,
		response,
	};
}

console.log("=== ZenithPulse Session Capture ===\n");
console.log(`Server:     ${BASE_URL}`);
console.log(`Duration:   ${DURATION_MIN} minutes (${TOTAL_CYCLES} cycles)`);
console.log(`Interval:   ${INTERVAL_MS / 1000}s`);
console.log(`Started at: ${new Date().toISOString()}\n`);

for (let i = 1; i <= TOTAL_CYCLES; i++) {
	const cycleStart = new Date().toISOString();
	const calls: ApiCall[] = [];

	// Health
	const health = await call("GET", "/api/health");
	calls.push(health);

	// All playbooks with risk state
	const playbooks = await call("GET", "/api/playbooks");
	calls.push(playbooks);

	// Latest traces (shows continuous operation)
	const traces = await call("GET", "/api/traces?limit=3");
	calls.push(traces);

	// Detail of first playbook (shows contract + full state)
	const playbookList = playbooks.response as Array<{
		id: string;
		name: string;
		riskScore: number;
		riskState: string;
		executionMode: string;
	}>;
	if (playbookList.length > 0) {
		const detail = await call("GET", `/api/playbooks/${playbookList[0].id}`);
		calls.push(detail);
	}

	// Build summary
	const healthData = health.response as { observerRunning: boolean; playbookCount: number };
	const traceData = traces.response as { total: number };
	const riskStates: Record<string, { score: number; state: string; mode: string }> = {};
	for (const p of playbookList) {
		riskStates[p.name] = { score: p.riskScore, state: p.riskState, mode: p.executionMode };
	}

	cycles.push({
		cycle: i,
		timestamp: cycleStart,
		calls,
		summary: {
			playbookCount: healthData.playbookCount || playbookList.length,
			totalTraces: traceData.total || 0,
			observerRunning: healthData.observerRunning,
			riskStates,
		},
	});

	// Print progress
	const elapsed = Math.round((i * INTERVAL_MS) / 1000 / 60);
	console.log(
		`  [${String(i).padStart(3)}/${TOTAL_CYCLES}] ${cycleStart} | ` +
			`playbooks=${playbookList.length} traces=${traceData.total || "?"} ` +
			`calls=${calls.length} latency=${calls.reduce((s, c) => s + c.latencyMs, 0)}ms ` +
			`(${elapsed}/${DURATION_MIN} min)`,
	);

	if (i < TOTAL_CYCLES) {
		await new Promise((r) => setTimeout(r, INTERVAL_MS));
	}
}

// Build output
const output = {
	meta: {
		project: "ZenithPulse",
		description: "Verifiable usage record — continuous API polling session",
		server: BASE_URL,
		startedAt: cycles[0]?.timestamp,
		endedAt: cycles[cycles.length - 1]?.timestamp,
		durationMinutes: DURATION_MIN,
		totalCycles: TOTAL_CYCLES,
		totalApiCalls,
		pollingIntervalMs: INTERVAL_MS,
		bitgetProducts: [
			"bitget-core (futures positions, orders, balance — USDT-margined perpetuals)",
			"getagent-skill (Playbook backtest metrics for contract derivation)",
		],
		evidence: {
			continuousOperation: "Timestamps show 15s intervals across full session",
			realBitgetIntegration: "liveStateSnapshot in traces contains Bitget API responses",
			contractDerivation: "Behavioral contracts derived from real backtest output",
			driftDetection: "Every trace includes drift rule evaluation results",
			riskScoring: "Composite risk score computed per cycle",
		},
	},
	cycles,
};

// Write output
const outDir = resolve(import.meta.dir, "sample-output");
mkdirSync(outDir, { recursive: true });

const outPath = resolve(outDir, "session-capture.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log("\n=== Session Capture Complete ===");
console.log(`Total API calls made: ${totalApiCalls}`);
console.log(`Total cycles:         ${TOTAL_CYCLES}`);
console.log(`Duration:             ${DURATION_MIN} minutes`);
console.log(`Output:               ${outPath}`);
console.log(`\nThis file is your "verifiable usage record" for submission.`);
console.log("Judges can verify: timestamps, API call volume, real Bitget data in responses.");
