export const SKILL_MARKDOWN = `# ZenithPulse

Autonomous risk enforcement and observability runtime for Bitget Playbooks. ZenithPulse derives behavioral contracts from backtest output, monitors live execution for drift, scores risk in real-time, enforces reactively (cancel orders, close positions), and traces every decision — so developers deploying Playbooks have visibility and protection without writing any config.

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

## MCP Configuration

Add this to your MCP client config (Claude Desktop, Cursor, etc.):

\`\`\`json
{
  "mcpServers": {
    "zenithpulse": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/sdk", "client", "--transport", "sse", "--url", "https://your-render-url.onrender.com/mcp"]
    }
  }
}
\`\`\`

Or for local stdio transport:

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
`;
