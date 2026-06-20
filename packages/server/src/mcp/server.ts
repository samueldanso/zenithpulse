import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { getDb } from "../db/client.js";
import type { McpRuntimeState } from "./tools.js";
import { registerTools } from "./tools.js";

type Db = ReturnType<typeof getDb>;

export async function startMcpServer(db: Db, runtimeState?: McpRuntimeState): Promise<void> {
	const server = new McpServer({
		name: "zenithpulse",
		version: "1.0.0",
	});

	registerTools(server, db, runtimeState);

	const transport = new StdioServerTransport();
	await server.connect(transport);
	process.stderr.write("[mcp] Server started on stdio\n");
}
