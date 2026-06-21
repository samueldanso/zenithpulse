# zenithpulse-mcp

MCP server for [ZenithPulse](https://github.com/samueldanso/zenithpulse) — autonomous risk enforcement and observability runtime for Bitget Playbooks.

## Install

No install needed. Add to your MCP client config:

### Remote (Streamable HTTP — recommended)

```json
{
  "mcpServers": {
    "zenithpulse": {
      "url": "https://zenithpulse-server.onrender.com/mcp"
    }
  }
}
```

### Local (stdio via npx)

```json
{
  "mcpServers": {
    "zenithpulse": {
      "command": "npx",
      "args": ["zenithpulse-mcp"],
      "env": {
        "ZENITHPULSE_API_URL": "https://zenithpulse-server.onrender.com"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `list_playbooks` | List all monitored playbooks with risk state |
| `get_risk_state` | Current risk score + drift results for a playbook |
| `get_traces` | Decision trace history (audit trail) |
| `switch_mode` | Change enforcement mode (enforce/observe/silent) |
| `get_health` | Runtime health + observer state |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZENITHPULSE_API_URL` | `https://zenithpulse-server.onrender.com` | ZenithPulse server URL |

## License

MIT
