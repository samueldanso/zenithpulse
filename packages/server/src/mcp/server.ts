import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { getDb } from "../db/client.js";
import { registerTools } from "./tools.js";

type Db = ReturnType<typeof getDb>;

export async function startMcpServer(db: Db): Promise<void> {
	const server = new McpServer({
		name: "zenithpulse",
		version: "1.0.0",
	});

	registerTools(server, db);

	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.log("[mcp] Server started on stdio");
}
