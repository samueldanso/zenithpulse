/**
 * Fetch recent decision traces — the audit trail of what ZenithPulse observed and decided.
 *
 * Usage:
 *   bun examples/get-traces.ts
 *   bun examples/get-traces.ts http://localhost:3001
 *   PLAYBOOK_ID=my-strategy bun examples/get-traces.ts
 */

const BASE_URL = process.argv[2] || "https://zenithpulse-server.onrender.com";
const playbookId = process.env.PLAYBOOK_ID;

const params = new URLSearchParams({ limit: "10" });
if (playbookId) params.set("playbook_id", playbookId);

const res = await fetch(`${BASE_URL}/api/traces?${params}`);
const { data: traces, total } = await res.json();

console.log("=== Decision Traces ===\n");
console.log(`Total traces: ${total}`);
console.log(`Showing: ${traces.length}\n`);

if (traces.length === 0) {
	console.log("No traces yet. The observer loop records a trace every 15s cycle.");
	console.log("Run the server and wait for at least one observation cycle.");
	process.exit(0);
}

for (const t of traces) {
	const action = t.enforcementAction === "none" ? "—" : `⚡ ${t.enforcementAction}`;
	console.log(`  [${t.timestamp}] risk=${t.riskScore} (${t.riskState}) action=${action}`);
	if (t.reasoning) console.log(`     reason: ${t.reasoning}`);
	console.log("");
}

console.log(`\nFull response:\n${JSON.stringify(traces.slice(0, 3), null, 2)}`);
if (traces.length > 3) console.log(`  ... and ${traces.length - 3} more`);
