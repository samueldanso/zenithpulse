# ZenithPulse

Autonomous risk enforcement and observability runtime for Bitget Playbooks.

Uses the backtest envelope as the policy contract and live execution drift as the risk signal.

**Live:** [Dashboard](https://zenithpulse-dashboard.vercel.app) | [Server](https://zenithpulse-server.onrender.com/api/health) | [SKILL.md](https://zenithpulse-server.onrender.com/skill.md)

---

## Problem

Bitget's agent stack covers strategy authoring, backtesting, deployment, and execution — but once a Playbook goes live, nothing watches it. A strategy can drift from its backtest envelope, trade unauthorized assets, breach drawdown limits, or degrade in performance — all with zero detection, zero scoring, and zero enforcement.

The gap between "Playbook deployed" and "capital lost" is completely empty.

## Solution

ZenithPulse fills this gap with six components:

| Component | What it does |
|---|---|
| **Backtest-as-policy** | Reads backtest metrics from `getagent-skill` API, derives a behavioral contract automatically. Zero config. |
| **Drift engine** | Polls live execution state via `bitget-core` every 15s. Detects deviation from the behavioral contract. |
| **Risk scoring** | Composite per-Playbook risk score (0–100), updated in real time. |
| **Reactive enforcement** | In `enforce` mode: cancels violating orders, closes breaching positions. |
| **Decision trace** | Structured forensic record per observation — what was seen, which rule applied, what happened. |
| **Alerts** | Telegram notification within seconds of any violation or enforcement action. |

**Key insight:** The Playbook's own backtest output IS the behavioral contract. Deploy a Playbook, connect ZenithPulse — monitoring + enforcement live in under 5 minutes with zero configuration.

---

## Bitget Products Integrated

| Product | Usage |
|---|---|
| **`bitget-core`** (Agent Hub) | Live state reads (positions, orders, balance) + enforcement writes (`futures_cancel_orders`, `futures_place_order` tradeSide:close) on USDT-margined perpetual futures |
| **`getagent-skill`** (Playbook API) | Backtest metrics for behavioral contract derivation (trading_symbols, max_drawdown_pct, sharpe_ratio, margin_budget) |
| **GetClaw** | Narrative complement — Bitget signals; ZenithPulse adds risk layer with own alerting bot |

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.1
- Bitget API key with Read + Trade permissions ([create here](https://www.bitget.com/account/newapi))

### Install & Run

```bash
git clone https://github.com/samueldanso/zenithpulse.git
cd zenithpulse
cp .env.example .env
# Fill in: BITGET_API_KEY, BITGET_SECRET_KEY, BITGET_PASSPHRASE
bun install
bun run dev
```

Server starts at `http://localhost:3001`, dashboard at `http://localhost:3000`.

The observer loop auto-discovers your Playbooks, derives behavioral contracts from their backtest output, and begins monitoring immediately.

### Docker (self-hosted)

```bash
docker compose up
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          ZenithPulse Server                           │
│                                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────┐    │
│  │  Playbook   │    │  Observer    │    │   Drift Detection    │    │
│  │  API Client │───>│  Loop       │───>│   + Risk Scoring     │    │
│  │  (getagent) │    │  (15s poll) │    │                      │    │
│  └─────────────┘    └──────────────┘    └──────────┬───────────┘    │
│         │                  ^                        │                │
│         v                  │                        v                │
│  ┌─────────────┐    ┌─────┴────────┐    ┌──────────────────────┐    │
│  │ Behavioral  │    │  Bitget API  │    │   Enforcement        │    │
│  │ Contract    │    │  (bitget-    │    │   Engine             │    │
│  │ Derivation  │    │   core)      │    │   (enforce mode)     │    │
│  └─────────────┘    └──────────────┘    └──────────┬───────────┘    │
│                                                     │                │
│                     ┌──────────────┐                │                │
│                     │  Decision    │<───────────────┘                │
│                     │  Trace +     │                                 │
│                     │  Audit Log   │──────> SQLite                   │
│                     └──────┬───────┘                                 │
│                            │                                         │
│                            v                                         │
│                     ┌──────────────┐    ┌──────────────────────┐    │
│                     │  Telegram    │    │   Hono REST API      │    │
│                     │  Alerts      │    │   + SSE Events       │    │
│                     └──────────────┘    └──────────┬───────────┘    │
│                                                     │                │
└─────────────────────────────────────────────────────┼────────────────┘
                                                      │
                                              ┌───────v───────┐
                                              │  Next.js      │
                                              │  Dashboard    │
                                              └───────────────┘
```

### Observer Loop (each cycle)

1. Poll Bitget API → build LiveState snapshot
2. Load current BehavioralContract (derived from backtest)
3. Drift detection: compare LiveState vs Contract → DriftResult[]
4. Compute composite risk score from drift results
5. IF mode=enforce AND violations → execute enforcement (cancel/close)
6. Build DecisionTrace (state + rules + results + actions + reasoning)
7. Persist trace to SQLite
8. Emit SSE event to connected dashboard clients
9. IF violations → fire Telegram alert

---

## Integration

ZenithPulse exposes four integration surfaces. The dashboard is a dev console — the product is the runtime and these interfaces.

### REST API

```bash
# List all monitored playbooks with risk state
curl https://zenithpulse-server.onrender.com/api/playbooks

# Get playbook detail (contract, risk score, last trace)
curl https://zenithpulse-server.onrender.com/api/playbooks/{id}

# Switch enforcement mode
curl -X PATCH https://zenithpulse-server.onrender.com/api/playbooks/{id}/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "enforce"}'

# List decision traces (paginated, filterable)
curl "https://zenithpulse-server.onrender.com/api/traces?limit=20"

# Subscribe to real-time events (SSE)
curl -N https://zenithpulse-server.onrender.com/api/events

# Health check
curl https://zenithpulse-server.onrender.com/api/health
```

### MCP Server (stdio)

Connect any MCP-compatible agent (Claude, Cursor, etc.) directly to ZenithPulse:

```json
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
```

**MCP Tools:**

| Tool | Description |
|---|---|
| `list_playbooks` | List all monitored playbooks with risk state |
| `get_risk_state` | Current risk score + drift results for a playbook |
| `get_traces` | Query decision trace history |
| `switch_mode` | Change operating mode (enforce/observe/silent) |
| `get_health` | Runtime health + uptime + observer state |

### SKILL.md (Agent Discovery)

Machine-readable integration guide served at `GET /skill.md` — no auth required. Pass the URL to any coding agent:

> "Configure ZenithPulse using the guide at https://zenithpulse-server.onrender.com/skill.md"

### SSE Events

Real-time event stream for dashboard and external consumers. Connect to `/api/events` for live updates on every observation cycle.

---

## Operating Modes

| Mode | Detection | Alerting | Enforcement |
|---|---|---|---|
| `enforce` | Active | Active | Active — cancels orders, closes positions |
| `observe` | Active | Active | Disabled — alerts only, no write actions |
| `silent` | Active | Disabled | Disabled — logs only, no alerts |

Default: `observe`. Switchable per-playbook at runtime via API or dashboard.

---

## Risk Scoring

Composite score (0–100) using max-of-weighted-factors:

```
risk_score = max(
  drawdown_proximity   * 40,   // how close to backtest max drawdown
  asset_drift_count    * 25,   // positions in unauthorized symbols
  oversize_ratio       * 20,   // exposure vs margin budget
  sharpe_degradation   * 15    // performance decay vs backtest
)
```

| Score | State | Meaning |
|---|---|---|
| 0–39 | `healthy` | Within backtest envelope |
| 40–69 | `elevated` | Approaching contract bounds |
| 70–100 | `critical` | Breach — enforcement fires in enforce mode |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Bun |
| Backend | Hono ^4 |
| Dashboard | Next.js ^16 (App Router) |
| Database | SQLite via Drizzle ORM (bun:sqlite) |
| API client | bitget-core (npm) |
| MCP | @modelcontextprotocol/sdk ^1 |
| Validation | Zod ^3 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Monorepo | Bun workspaces |

---

## Project Structure

```
zenithpulse/
├── packages/
│   ├── server/          # Hono API + observer loop + enforcement + MCP
│   │   └── src/
│   │       ├── api/         # REST routes + SSE + SKILL.md
│   │       ├── bitget/      # Bitget API client (bitget-core)
│   │       ├── contract/    # Behavioral contract derivation
│   │       ├── observer/    # Polling loop + state management
│   │       ├── drift/       # Drift detection + risk scoring
│   │       ├── enforce/     # Enforcement engine + actions
│   │       ├── trace/       # Decision trace recording
│   │       ├── mcp/         # MCP server + tool definitions
│   │       └── db/          # Drizzle schema + migrations
│   ├── dashboard/       # Next.js real-time monitoring UI
│   └── shared/          # Shared types + constants
├── Dockerfile           # Production container
├── docker-compose.yml   # Self-hosted deployment
└── render.yaml          # Render cloud deployment
```

---

## Deployment

| Component | Platform | URL |
|---|---|---|
| Server + Observer | Render (Docker, persistent disk) | https://zenithpulse-server.onrender.com |
| Dashboard | Vercel (Next.js) | https://zenithpulse-dashboard.vercel.app |
| Self-hosted | Docker Compose | `docker compose up` |

### Deploy Your Own

**Render (server):**
1. Fork this repo
2. Create a Web Service on Render, select Docker runtime
3. Add env vars (see `.env.example`)
4. Attach a disk at `/data` for SQLite persistence

**Vercel (dashboard):**
1. Import `packages/dashboard` as root directory
2. Set `NEXT_PUBLIC_API_URL` to your Render server URL

---

## Environment Variables

```bash
# Bitget Trading API (required)
BITGET_API_KEY=
BITGET_SECRET_KEY=
BITGET_PASSPHRASE=

# Playbook API (optional — mock mode if absent)
PLAYBOOK_ACCESS_KEY=
PLAYBOOK_MARGIN_BUDGET=100

# Telegram Alerts (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Server Config
DB_PATH=./data/zenithpulse.db
PORT=3001
POLL_INTERVAL_MS=15000
MODE_DEFAULT=observe
PAPER_TRADING=false
ALLOWED_ORIGINS=http://localhost:3000
```

---

## How It Differs from Existing Bitget Tools

| Existing Tool | What it does | What ZenithPulse adds |
|---|---|---|
| `getagent-skill` | Author, backtest, deploy Playbooks | Turns backtest metrics into live enforcement rules automatically |
| `bitget-core` | Execute trades, read account state | Continuous 15s polling loop comparing live state against derived contract |
| GetClaw | Deliver trade signals via Telegram | Risk-specific alerts with structured decision trace (what drifted, which rule, what action) |
| Bitget Dashboard | Manual portfolio view | Per-Playbook risk score, automated enforcement feed, contract-vs-reality comparison |

Nothing in the current Bitget stack derives rules from backtest, continuously monitors against them, scores risk, acts on violations, and produces a decision trace. ZenithPulse is additive — it consumes existing APIs and adds the behavioral contract + drift + enforcement + trace layer.

---

## Commands

```bash
bun install          # Install all workspace deps
bun run dev          # Start server + dashboard
bun run build        # Build all packages
bun run check        # Biome lint + format check
bun run test         # Run vitest test suite
bun run typecheck    # TypeScript type checking
```

---

## License

MIT

---

**Track:** Bitget AI Base Camp S1 — Track 2 (Trading Infra)
