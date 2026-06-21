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

## Agent Integration

ZenithPulse is agent infrastructure. The primary consumer is your AI agent — a trading agent, portfolio manager, or any autonomous system running Bitget Playbooks. You point your agent at ZenithPulse; it handles risk monitoring from there.

### Connect Your Agent

**Step 1: Agent discovers capabilities**

Your agent reads the skill definition to learn what ZenithPulse offers:

```
https://zenithpulse-server.onrender.com/skill.md
```

Or tell your agent: _"Read https://zenithpulse-server.onrender.com/skill.md and connect to ZenithPulse."_

**Step 2: Agent connects via MCP**

Add to your agent's MCP config (Claude Desktop, Cursor, custom agent framework):

```json
{
  "mcpServers": {
    "zenithpulse": {
      "url": "https://zenithpulse-server.onrender.com/mcp"
    }
  }
}
```

Zero install. Your agent now has 5 tools for real-time risk monitoring and enforcement control.

**Or via npx (local stdio transport):**

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

### MCP Tools

| Tool | What your agent can do |
|---|---|
| `list_playbooks` | See all monitored playbooks with risk state |
| `get_risk_state` | Check risk score + drift results for a playbook |
| `get_traces` | Read decision trace history (audit trail) |
| `switch_mode` | Change enforcement mode (enforce/observe/silent) |
| `get_health` | Check runtime health + observer state |

### REST API

For agent frameworks that don't support MCP, or for direct programmatic access:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Server health + observer state |
| `GET` | `/api/playbooks` | List all monitored playbooks |
| `GET` | `/api/playbooks/:id` | Playbook detail with behavioral contract |
| `PATCH` | `/api/playbooks/:id/mode` | Switch enforcement mode |
| `GET` | `/api/traces` | Decision traces (query: `playbook_id`, `limit`, `action`) |
| `GET` | `/api/events` | SSE stream of real-time risk events |
| `GET` | `/skill.md` | Machine-readable skill definition |
| `ALL` | `/mcp` | MCP Streamable HTTP endpoint |

**Try it now:**

```bash
curl https://zenithpulse-server.onrender.com/api/health
curl https://zenithpulse-server.onrender.com/api/playbooks
curl -X PATCH https://zenithpulse-server.onrender.com/api/playbooks/{id}/mode \
  -H "Content-Type: application/json" -d '{"mode": "enforce"}'
```

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
│   ├── server/          # Hono API + observer loop + enforcement + MCP endpoint
│   │   └── src/
│   │       ├── api/         # REST routes + SSE + /mcp (Streamable HTTP)
│   │       ├── bitget/      # Bitget API client (bitget-core)
│   │       ├── contract/    # Behavioral contract derivation
│   │       ├── observer/    # Polling loop + state management
│   │       ├── drift/       # Drift detection + risk scoring
│   │       ├── enforce/     # Enforcement engine + actions
│   │       ├── trace/       # Decision trace recording
│   │       ├── mcp/         # MCP tool definitions + stdio server
│   │       └── db/          # Drizzle schema + migrations
│   ├── mcp/             # Publishable MCP package (npx zenithpulse-mcp)
│   ├── dashboard/       # Next.js real-time monitoring UI
│   └── shared/          # Shared types + constants
├── SKILL.md             # Machine-readable skill definition (YAML frontmatter)
├── .mcp.json            # MCP auto-discovery config
├── server.json          # MCP Registry entry (npm + remote)
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
