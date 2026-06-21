/**
 * Switch a Playbook's enforcement mode (observe → enforce → silent).
 *
 * Usage:
 *   PLAYBOOK_ID=my-strategy MODE=enforce bun examples/switch-mode.ts
 *   PLAYBOOK_ID=my-strategy MODE=observe bun examples/switch-mode.ts http://localhost:3001
 */

const BASE_URL = process.argv[2] || "https://zenithpulse-server.onrender.com";
const playbookId = process.env.PLAYBOOK_ID;
const mode = process.env.MODE;

if (!playbookId || !mode) {
	console.log("Usage: PLAYBOOK_ID=<id> MODE=<enforce|observe|silent> bun examples/switch-mode.ts");
	console.log("\nFirst list playbooks to get an ID:");
	console.log("  bun examples/list-playbooks.ts");
	process.exit(1);
}

if (!["enforce", "observe", "silent"].includes(mode)) {
	console.log(`Invalid mode: "${mode}". Must be: enforce, observe, or silent.`);
	process.exit(1);
}

const res = await fetch(`${BASE_URL}/api/playbooks/${playbookId}/mode`, {
	method: "PATCH",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({ mode }),
});

if (!res.ok) {
	const err = await res.json();
	console.log(`Error: ${err.error || res.statusText}`);
	process.exit(1);
}

const data = await res.json();
console.log("=== Mode Switched ===\n");
console.log(`Playbook: ${data.id}`);
console.log(`Mode:     ${data.mode}`);
console.log("\nThe observer loop will use this mode on the next cycle (within 15s).");
