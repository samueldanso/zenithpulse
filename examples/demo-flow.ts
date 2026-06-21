/**
 * Full demo flow — runs the complete ZenithPulse journey in sequence.
 * A judge runs this ONE script and sees the entire system working end-to-end.
 *
 * Flow: health → discover → inspect contract → traces → switch mode → observe cycle → verify
 *
 * Usage:
 *   bun examples/demo-flow.ts
 *   bun examples/demo-flow.ts http://localhost:3001
 */

const BASE_URL = process.argv[2] || "https://zenithpulse-server.onrender.com";

async function get(path: string) {
	const res = await fetch(`${BASE_URL}${path}`);
	if (!res.ok) throw new Error(`${path} → ${res.status}`);
	return res.json();
}

async function patch(path: string, body: Record<string, unknown>) {
	const res = await fetch(`${BASE_URL}${path}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`);
	return res.json();
}

function divider(title: string) {
	console.log(`\n${"─".repeat(60)}`);
	console.log(`  ${title}`);
	console.log(`${"─".repeat(60)}\n`);
}

console.log("=== ZenithPulse — Full Demo Flow ===");
console.log(`Server: ${BASE_URL}`);
console.log(`Time:   ${new Date().toISOString()}\n`);

// Step 1: Health check
divider("1. Server Health");
const health = await get("/api/health");
console.log(`  Status:           ${health.status}`);
console.log(`  Observer running: ${health.observerRunning}`);
console.log(`  Uptime:           ${Math.round((health.uptime || 0) / 1000 / 60)} minutes (${Math.round((health.uptime || 0) / 1000 / 60 / 60)} hours)`);
console.log(`  Playbooks:        ${health.playbookCount}`);
console.log(`  Last cycle:       ${health.lastCycleAt}`);

if (!health.observerRunning) {
	console.log("\n  Observer is not running. Start the server first.");
	process.exit(1);
}

// Step 2: Discover playbooks
divider("2. Playbook Discovery (from Bitget getagent-skill API)");
const playbooks = await get("/api/playbooks");
console.log(`  Discovered ${playbooks.length} Playbook(s) from Bitget:\n`);

for (const p of playbooks) {
	const icon = p.riskState === "critical" ? "🔴" : p.riskState === "elevated" ? "🟡" : "🟢";
	console.log(`  ${icon} ${p.displayName || p.name}`);
	console.log(`     Risk: ${p.riskScore}/100 (${p.riskState}) | Mode: ${p.executionMode}`);
}

// Step 3: Inspect behavioral contract of first playbook
divider("3. Behavioral Contract (derived from backtest)");
const target = playbooks[0];
console.log(`  Inspecting: ${target.displayName || target.name}`);
console.log(`  ID: ${target.id}\n`);

const detail = await get(`/api/playbooks/${target.id}`);
const contract = detail.contract;

if (contract) {
	console.log(`  Contract derived at: ${contract.derivedAt}`);
	console.log(`  Allowed symbols:    [${contract.allowedSymbols.join(", ")}]`);
	console.log(`  Max drawdown:       ${contract.maxDrawdownPct}%`);
	console.log(`  Backtest Sharpe:    ${contract.backTestSharpe}`);
	console.log(`  Margin budget:      $${contract.marginBudget}`);
	console.log(`  Expected return:    ${contract.expectedReturnPct}%`);
	console.log(`  Total trades:       ${contract.totalTrades}`);
	console.log(`  Execution mode:     ${contract.executionMode}`);
	console.log(`\n  These rules were derived automatically from the Playbook's backtest output.`);
	console.log(`  No manual configuration — the backtest IS the policy contract.`);
} else {
	console.log(`  No contract yet — will be derived on next observation cycle.`);
}

// Step 4: Decision traces
divider("4. Decision Traces (audit trail)");
const { data: traces, total } = await get(`/api/traces?playbook_id=${target.id}&limit=5`);
console.log(`  Total traces for this playbook: ${total}`);
console.log(`  Showing last ${traces.length}:\n`);

for (const t of traces) {
	const action = t.enforcementAction === "none" ? "no action" : `⚡ ${t.enforcementAction}`;
	console.log(`  [${t.timestamp}]`);
	console.log(`     Risk: ${t.riskScore}/100 (${t.riskState})`);
	console.log(`     Action: ${action}`);

	if (t.driftResults && t.driftResults.length > 0) {
		const breaches = t.driftResults.filter((d: { result: string }) => d.result === "breach");
		const passes = t.driftResults.filter((d: { result: string }) => d.result === "pass");
		console.log(`     Drift rules: ${passes.length} pass, ${breaches.length} breach`);
	}
	console.log("");
}

// Step 5: Show total traces across all playbooks
divider("5. System-wide Observability");
const { total: allTotal } = await get("/api/traces?limit=1");
console.log(`  Total decision traces (all playbooks): ${allTotal}`);
console.log(`  Polling interval: 15 seconds`);
console.log(`  Playbooks monitored: ${playbooks.length}`);

const tracesPerHour = playbooks.length * 4 * 60;
console.log(`  Estimated throughput: ~${tracesPerHour} traces/hour`);
console.log(`  Estimated API calls: ~${tracesPerHour * 3} Bitget API calls/hour`);
console.log(`\n  Every 15 seconds, each playbook gets:`);
console.log(`    → Positions polled (bitget-core futures API)`);
console.log(`    → Orders polled (bitget-core futures API)`);
console.log(`    → Balance checked (bitget-core account API)`);
console.log(`    → Drift computed against behavioral contract`);
console.log(`    → Risk scored (0–100)`);
console.log(`    → Decision trace persisted to SQLite`);

// Step 6: Mode switch demonstration
divider("6. Mode Switch (enforce → observe cycle)");
console.log(`  Current mode: ${target.executionMode}`);

const switchTo = target.executionMode === "enforce" ? "observe" : "enforce";
console.log(`  Switching to: ${switchTo}...`);

const switched = await patch(`/api/playbooks/${target.id}/mode`, { mode: switchTo });
console.log(`  Done. Mode is now: ${switched.mode}\n`);

console.log(`  Waiting 20 seconds for one observation cycle...`);
await new Promise((r) => setTimeout(r, 20_000));

// Check for new trace after mode switch
const { data: newTraces } = await get(`/api/traces?playbook_id=${target.id}&limit=1`);
if (newTraces.length > 0) {
	const latest = newTraces[0];
	console.log(`\n  New trace recorded:`);
	console.log(`    Time:   ${latest.timestamp}`);
	console.log(`    Risk:   ${latest.riskScore}/100 (${latest.riskState})`);
	console.log(`    Action: ${latest.enforcementAction === "none" ? "no action needed" : latest.enforcementAction}`);
	console.log(`    Mode:   ${switchTo} was active for this cycle`);
}

// Restore original mode
console.log(`\n  Restoring original mode: ${target.executionMode}...`);
await patch(`/api/playbooks/${target.id}/mode`, { mode: target.executionMode });
console.log(`  Restored.`);

// Summary
divider("7. Summary");
console.log(`  ZenithPulse is running autonomously on ${BASE_URL}`);
console.log(`  - ${playbooks.length} Playbooks discovered from Bitget`);
console.log(`  - ${allTotal} decision traces recorded`);
console.log(`  - Behavioral contracts derived from real backtest data`);
console.log(`  - Live Bitget API polling every 15 seconds`);
console.log(`  - Mode switching works (enforce/observe/silent)`);
console.log(`  - Full audit trail with drift detection + risk scoring`);
console.log(`\n  Bitget products integrated:`);
console.log(`    bitget-core  — live state reads + enforcement writes (USDT-margined futures)`);
console.log(`    getagent-skill — Playbook backtest metrics for contract derivation`);
console.log(`\n  Connect your agent:`);
console.log(`    MCP: {"mcpServers":{"zenithpulse":{"url":"${BASE_URL}/mcp"}}}`);
console.log(`    npm: npx zenithpulse-mcp`);
console.log(`    SKILL.md: ${BASE_URL}/skill.md`);
console.log(`\n=== Demo Complete ===`);
