/**
 * Capture a live session — runs for N minutes, polls every 15s, saves all responses.
 * Produces the "verifiable usage record" required for hackathon submission.
 *
 * Usage:
 *   bun examples/capture-session.ts                     # 5 min, live server
 *   DURATION_MIN=10 bun examples/capture-session.ts     # 10 min
 *   bun examples/capture-session.ts http://localhost:3001
 *
 * Output: examples/sample-output/session-<timestamp>.json
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = process.argv[2] || "https://zenithpulse-server.onrender.com";
const DURATION_MIN = Number(process.env.DURATION_MIN || "5");
const INTERVAL_MS = 15_000;
const TOTAL_CYCLES = Math.ceil((DURATION_MIN * 60 * 1000) / INTERVAL_MS);

interface LogEntry {
	cycle: number;
	timestamp: string;
	endpoint: string;
	status: number;
	latencyMs: number;
	response: unknown;
}

const log: LogEntry[] = [];

async function poll(cycle: number, path: string): Promise<LogEntry> {
	const start = Date.now();
	const res = await fetch(`${BASE_URL}${path}`);
	const latencyMs = Date.now() - start;
	const response = await res.json();
	return {
		cycle,
		timestamp: new Date().toISOString(),
		endpoint: path,
		status: res.status,
		latencyMs,
		response,
	};
}

console.log(`=== ZenithPulse Session Capture ===\n`);
console.log(`Server:   ${BASE_URL}`);
console.log(`Duration: ${DURATION_MIN} minutes (${TOTAL_CYCLES} cycles)`);
console.log(`Interval: ${INTERVAL_MS / 1000}s\n`);
console.log(`Starting...\n`);

for (let i = 1; i <= TOTAL_CYCLES; i++) {
	const health = await poll(i, "/api/health");
	const playbooks = await poll(i, "/api/playbooks");
	const traces = await poll(i, "/api/traces?limit=5");

	log.push(health, playbooks, traces);

	const playbookCount = Array.isArray(playbooks.response) ? playbooks.response.length : 0;
	console.log(
		`  [${i}/${TOTAL_CYCLES}] ${health.timestamp} — ` +
			`health=${(health.response as { status: string }).status} ` +
			`playbooks=${playbookCount} ` +
			`latency=${health.latencyMs}ms`,
	);

	if (i < TOTAL_CYCLES) {
		await new Promise((r) => setTimeout(r, INTERVAL_MS));
	}
}

const outDir = resolve(import.meta.dir, "sample-output");
mkdirSync(outDir, { recursive: true });

const filename = `session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const outPath = resolve(outDir, filename);

const output = {
	meta: {
		server: BASE_URL,
		startedAt: log[0]?.timestamp,
		endedAt: log[log.length - 1]?.timestamp,
		durationMin: DURATION_MIN,
		totalCycles: TOTAL_CYCLES,
		totalApiCalls: log.length,
	},
	entries: log,
};

writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`\n=== Done ===`);
console.log(`Total API calls: ${log.length}`);
console.log(`Saved to: ${outPath}`);
console.log(`\nSubmit this file as your "verifiable usage record".`);
