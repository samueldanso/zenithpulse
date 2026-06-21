---
name: zenithpulse
version: 1.0.0
description: >
  Monitors your Bitget Playbooks 24/7 and detects when they break their own backtest rules. Use to check risk state, inspect decision traces, switch enforcement modes, or query the audit trail. Invoke for any Playbook monitoring, risk scoring, enforcement control, or violation history.
homepage: https://zenithpulse-server.onrender.com
docs: https://github.com/samueldanso/zenithpulse
metadata: {"api_base": "https://zenithpulse-server.onrender.com", "mcp_server": "packages/mcp/src/index.ts", "mcp_endpoint": "/mcp"}
---

# ZenithPulse

Monitors your Bitget Playbooks and enforces when they drift from their own backtest rules. Reads backtest results as the rules, detects violations every 15s, scores risk 0–100, enforces automatically (cancel orders, close positions), and records every decision.

**Base URL:** `http://localhost:3001` (self-hosted) · `https://zenithpulse-server.onrender.com` (production)

**Dashboard:** [zenithpulse-dashboard.vercel.app](https://zenithpulse-dashboard.vercel.app)

---

## How It Works

```
Autonomous loop — every 15 seconds:

  Observe → Detect drift → Score risk → Act → Trace
     ↑                                        │
     └────────────────────────────────────────┘

  Observe:  poll positions, orders, balance (bitget-core)
  Detect:   compare live state vs behavioral contract
  Score:    compute composite risk 0–100
  Act:      cancel orders / close positions (if mode=enforce)
  Trace:    persist structured decision record + emit SSE event
```

Behavioral contract derived once from Playbook backtest output (getagent-skill API). No manual config.

**Three modes:**
- `enforce` — active risk management, cancels orders / closes positions on drift
- `observe` — monitors and traces but takes no action (default)
- `silent` — minimal logging, no enforcement, no alerts

---

## Connect via MCP

### Remote (Streamable HTTP — no setup required)

Connect any MCP client directly to the production endpoint:

```json
{
  "mcpServers": {
    "zenithpulse": {
      "url": "https://zenithpulse-server.onrender.com/mcp"
    }
  }
}
```

### Local (stdio transport)

Run the MCP server locally via stdio:

```json
{
  "mcpServers": {
    "zenithpulse": {
      "command": "npx",
      "args": ["-y", "zenithpulse-mcp"],
      "env": {
        "ZENITHPULSE_API_URL": "https://zenithpulse-server.onrender.com"
      }
    }
  }
}
```

Or from source:

```json
{
  "mcpServers": {
    "zenithpulse": {
      "command": "bun",
      "args": ["run", "packages/mcp/src/index.ts"],
      "env": {
        "ZENITHPULSE_API_URL": "https://zenithpulse-server.onrender.com"
      }
    }
  }
}
```

---

## MCP Tools (5)

### `list_playbooks`

List all monitored playbooks with current risk state.

**No parameters.**

**Returns:**
```json
[
  {
    "id": "btc-ema-cross",
    "name": "BTC EMA Cross",
    "risk_score": 42,
    "risk_state": "elevated",
    "mode": "observe"
  }
]
```

---

### `get_risk_state`

Get current risk score, drift results, and last cycle time for a playbook.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `playbook_id` | string | yes | The playbook strategy ID |

**Returns:**
```json
{
  "playbook_id": "btc-ema-cross",
  "risk_score": 42,
  "risk_state": "elevated",
  "mode": "observe",
  "last_cycle_at": "2026-06-20T12:00:00Z",
  "drift_results": [
    { "metric": "drawdown", "expected": 12.5, "actual": 15.2, "breached": true }
  ]
}
```

---

### `get_traces`

Get recent decision traces for a playbook — the full audit trail of what the system observed and decided.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `playbook_id` | string | yes | The playbook strategy ID |
| `limit` | number | no | Number of traces to return (default: 10, max: 100) |
| `action` | string | no | Filter by enforcement action: `none`, `cancel_order`, `close_position` |

**Returns:**
```json
[
  {
    "id": "trace-uuid",
    "timestamp": "2026-06-20T12:00:00Z",
    "risk_score": 72,
    "risk_state": "critical",
    "enforcement_action": "cancel_order",
    "action_target": "order-12345",
    "action_result": "success",
    "reasoning": "Drawdown 18.2% exceeds contract limit 12.5%. Cancelling pending limit order."
  }
]
```

---

### `switch_mode`

Change operating mode for a playbook (enforce, observe, or silent).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `playbook_id` | string | yes | The playbook strategy ID |
| `mode` | string | yes | One of: `enforce`, `observe`, `silent` |

**Returns:**
```json
{
  "playbook_id": "btc-ema-cross",
  "mode": "enforce",
  "previous_mode": "observe"
}
```

---

### `get_health`

Get server health, uptime, and observer state.

**No parameters.**

**Returns:**
```json
{
  "status": "ok",
  "uptime_ms": 3600000,
  "observer_running": true,
  "last_cycle_at": "2026-06-20T12:00:00Z",
  "playbook_count": 3
}
```

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Server health + observer state |
| `GET` | `/api/playbooks` | List all monitored playbooks |
| `GET` | `/api/playbooks/:id` | Playbook detail with behavioral contract |
| `PATCH` | `/api/playbooks/:id/mode` | Switch enforcement mode |
| `GET` | `/api/traces` | Decision traces (query: `playbook_id`, `limit`, `action`) |
| `GET` | `/api/events` | SSE stream of real-time risk events |
| `GET` | `/skill.md` | This file (machine-readable skill definition) |
| `ALL` | `/mcp` | MCP Streamable HTTP endpoint |

---

## Quickstart

```bash
# Clone and run locally
git clone https://github.com/samueldanso/zenithpulse
cd zenithpulse
cp .env.example .env
# Fill in BITGET_API_KEY, BITGET_SECRET_KEY, BITGET_PASSPHRASE
bun install && bun run dev
# Server: http://localhost:3001 | Dashboard: http://localhost:3000
```

Or with Docker:

```bash
docker compose up
# Server: http://localhost:3001 | Dashboard: http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BITGET_API_KEY` | yes | Bitget API key |
| `BITGET_SECRET_KEY` | yes | Bitget API secret |
| `BITGET_PASSPHRASE` | yes | Bitget API passphrase |
| `DB_PATH` | no | SQLite path (default: `./zenithpulse.db`) |
| `PORT` | no | Server port (default: `3001`) |
| `MODE_DEFAULT` | no | Default mode: `enforce`, `observe`, `silent` (default: `observe`) |
| `PLAYBOOK_MARGIN_BUDGET` | no | Fallback margin budget if not in API response |
| `ALLOWED_ORIGINS` | no | CORS origins, comma-separated |
