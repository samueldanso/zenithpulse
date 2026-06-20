export const SKILL_MARKDOWN = `# ZenithPulse

Autonomous risk enforcement and observability runtime for Bitget Playbooks. ZenithPulse derives behavioral contracts from backtest output, monitors live execution for drift, scores risk in real-time, enforces reactively (cancel orders, close positions), and traces every decision — so developers deploying Playbooks have visibility and protection without writing any config.

## Quickstart

\`\`\`bash
git clone https://github.com/samueldanso/zenithpulse
cd zenithpulse
cp .env.example .env
# Fill in BITGET_API_KEY, BITGET_SECRET_KEY, BITGET_PASSPHRASE
bun install
bun run dev
# Server: http://localhost:3001
# Dashboard: http://localhost:3000
\`\`\`

Or with Docker:

\`\`\`bash
docker compose up
\`\`\`

## REST API

\`\`\`bash
# List all monitored playbooks
curl https://your-server.onrender.com/api/playbooks

# Get playbook detail with contract
curl https://your-server.onrender.com/api/playbooks/{id}

# Switch enforcement mode
curl -X PATCH https://your-server.onrender.com/api/playbooks/{id}/mode \\
  -H "Content-Type: application/json" \\
  -d '{"mode": "enforce"}'

# List decision traces
curl "https://your-server.onrender.com/api/traces?playbook_id={id}&limit=10"

# Server health
curl https://your-server.onrender.com/api/health
\`\`\`

## Auth

Set \`ZENITHPULSE_API_KEY\` in your environment to enable API key auth on write endpoints. Read endpoints (GET) are public by default.

## MCP Tools

Connect via MCP to interact with ZenithPulse programmatically:

### list_playbooks

List all monitored playbooks with current risk state.

**Parameters:** none

### get_risk_state

Get current risk score, drift results, and last cycle time for a playbook.

**Parameters:**
- \`playbook_id\` (string, required) — The playbook strategy ID

### get_traces

Get recent decision traces for a playbook.

**Parameters:**
- \`playbook_id\` (string, required) — The playbook strategy ID
- \`limit\` (number, optional, default: 10) — Number of traces to return (max 100)
- \`action\` (string, optional) — Filter by enforcement action (none, cancel_order, close_position)

### switch_mode

Change operating mode for a playbook.

**Parameters:**
- \`playbook_id\` (string, required) — The playbook strategy ID
- \`mode\` (string, required) — One of: enforce, observe, silent

### get_health

Get server health, uptime, and observer state.

**Parameters:** none

## MCP Configuration (Local)

ZenithPulse MCP runs via stdio transport. Add this to your MCP client config (Claude Desktop, Cursor, etc.):

\`\`\`json
{
  "mcpServers": {
    "zenithpulse": {
      "command": "bun",
      "args": ["run", "--cwd", "/path/to/zenithpulse/packages/server", "src/mcp-entry.ts"],
      "env": {
        "BITGET_API_KEY": "...",
        "BITGET_SECRET_KEY": "...",
        "BITGET_PASSPHRASE": "..."
      }
    }
  }
}
\`\`\`

> **Note:** The MCP server uses stdio transport only. It connects directly to your local SQLite database. For remote access, expose the REST API endpoints instead.
`;
