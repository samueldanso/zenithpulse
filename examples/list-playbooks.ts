/**
 * List all monitored Playbooks with their current risk state.
 *
 * Usage:
 *   bun examples/list-playbooks.ts
 *   bun examples/list-playbooks.ts http://localhost:3001
 */

const BASE_URL = process.argv[2] || "https://zenithpulse-server.onrender.com";

const res = await fetch(`${BASE_URL}/api/playbooks`);
const playbooks = await res.json();

console.log("=== Monitored Playbooks ===\n");

if (playbooks.length === 0) {
	console.log("No playbooks discovered yet. Start the server with valid Bitget API keys.");
	console.log("The observer loop will auto-discover Playbooks on first cycle.");
	process.exit(0);
}

console.log(`Found ${playbooks.length} playbook(s):\n`);

for (const p of playbooks) {
	const risk = p.riskState === "critical" ? "🔴" : p.riskState === "elevated" ? "🟡" : "🟢";
	console.log(`  ${risk} ${p.name || p.id}`);
	console.log(`     ID:         ${p.id}`);
	console.log(`     Risk:       ${p.riskScore}/100 (${p.riskState})`);
	console.log(`     Mode:       ${p.executionMode}`);
	console.log(`     Last seen:  ${p.lastObservedAt || "never"}`);
	console.log("");
}

console.log(`Full response:\n${JSON.stringify(playbooks, null, 2)}`);
