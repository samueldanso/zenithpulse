#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_URL = process.env.ZENITHPULSE_API_URL ?? "https://zenithpulse-server.onrender.com";

async function fetchApi(path: string): Promise<string> {
	const res = await fetch(`${API_URL}${path}`);
	if (!res.ok) throw new Error(`API ${path}: ${res.status} ${res.statusText}`);
	return JSON.stringify(await res.json(), null, 2);
}

const server = new McpServer({
	name: "zenithpulse",
	version: "1.0.0",
});

server.tool(
	"list_playbooks",
	"List all monitored playbooks with current risk state, score, and mode",
	{},
	async () => {
		const data = await fetchApi("/api/playbooks");
		return { content: [{ type: "text", text: data }] };
	},
);

server.tool(
	"get_risk_state",
	"Get current risk score, drift results, and last cycle time for a playbook",
	{ playbook_id: z.string().describe("The playbook strategy ID") },
	async ({ playbook_id }) => {
		const data = await fetchApi(`/api/playbooks/${playbook_id}`);
		return { content: [{ type: "text", text: data }] };
	},
);

server.tool(
	"get_traces",
	"Get recent decision traces for a playbook — full audit trail of observations and enforcement",
	{
		playbook_id: z.string().describe("The playbook strategy ID"),
		limit: z.number().optional().default(10).describe("Number of traces to return (max 100)"),
		action: z
			.string()
			.optional()
			.describe("Filter by enforcement action (none, cancel_order, close_position)"),
	},
	async ({ playbook_id, limit, action }) => {
		const params = new URLSearchParams({ playbook_id, limit: String(limit) });
		if (action) params.set("action", action);
		const data = await fetchApi(`/api/traces?${params}`);
		return { content: [{ type: "text", text: data }] };
	},
);

server.tool(
	"switch_mode",
	"Change operating mode for a playbook (enforce, observe, or silent)",
	{
		playbook_id: z.string().describe("The playbook strategy ID"),
		mode: z.enum(["enforce", "observe", "silent"]).describe("The new operating mode"),
	},
	async ({ playbook_id, mode }) => {
		const res = await fetch(`${API_URL}/api/playbooks/${playbook_id}/mode`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mode }),
		});
		if (!res.ok) throw new Error(`Mode switch failed: ${res.status}`);
		const data = JSON.stringify(await res.json(), null, 2);
		return { content: [{ type: "text", text: data }] };
	},
);

server.tool("get_health", "Get server health, uptime, and observer state", {}, async () => {
	const data = await fetchApi("/api/health");
	return { content: [{ type: "text", text: data }] };
});

server.resource("zenithpulse://health", "Server health + observer state", async (uri) => {
	const data = await fetchApi("/api/health");
	return { contents: [{ uri: uri.href, mimeType: "application/json", text: data }] };
});

server.resource("zenithpulse://playbooks", "All monitored playbooks + risk state", async (uri) => {
	const data = await fetchApi("/api/playbooks");
	return { contents: [{ uri: uri.href, mimeType: "application/json", text: data }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
