/**
 * Check ZenithPulse server health and observer state.
 *
 * Usage:
 *   bun examples/check-health.ts
 *   bun examples/check-health.ts http://localhost:3001
 */

const BASE_URL = process.argv[2] || "https://zenithpulse-server.onrender.com";

const res = await fetch(`${BASE_URL}/api/health`);
const data = await res.json();

console.log("=== ZenithPulse Health ===\n");
console.log(`Status:           ${data.status}`);
console.log(`Observer running: ${data.observerRunning}`);
console.log(`Uptime:           ${Math.round((data.uptime || data.uptimeMs || 0) / 1000 / 60)} minutes`);
console.log(`Playbooks:        ${data.playbookCount}`);
console.log(`Last cycle:       ${data.lastCycleAt || "not yet"}`);
console.log(`\nFull response:\n${JSON.stringify(data, null, 2)}`);
