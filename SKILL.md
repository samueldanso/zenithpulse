---
name: zenithpulse
version: 1.0.0
description: >
  Autonomous risk enforcement and observability runtime for Bitget Playbooks. Use when you need to monitor playbook risk state, inspect decision traces, check drift detection results, switch enforcement modes, or get real-time health of the observer loop. Invoke for any Bitget Playbook monitoring, risk scoring, enforcement control, or audit trail queries.
homepage: https://zenithpulse-server.onrender.com
docs: https://github.com/samueldanso/zenithpulse
metadata: {"api_base": "https://zenithpulse-server.onrender.com", "mcp_server": "packages/mcp/src/index.ts", "mcp_endpoint": "/mcp"}
---

# ZenithPulse

Autonomous risk enforcement and observability runtime for Bitget Playbooks. Derives behavioral contracts from backtest output, monitors live execution for drift, scores risk in real-time, enforces reactively (cancel orders, close positions), and traces every decision.

**Base URL:** `http://localhost:3001` (self-hosted) · `https://zenithpulse-server.onrender.com` (production)

**Dashboard:** [zenithpulse.vercel.app](https://zenithpulse.vercel.app)

---

## How It Works

```
Playbook backtest output → Behavioral contract derivation
  → Observer loop (polling every 30s)
    → Live state snapshot (positions, orders, balance)
    → Drift detection (compare live vs contract envelope)
    → Risk scoring (0–100)
    → Enforcement decision (if mode=enforce and risk > threshold)
      → Cancel orders / Close positions
    → Decision trace stored
    → Alert evaluation
```

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
      "type": "streamable-http",
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
      "args": ["zenithpulse-mcp"],
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
