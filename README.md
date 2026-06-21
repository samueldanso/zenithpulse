<p align="center">
  <img src="packages/dashboard/public/favicon-black.svg" alt="ZenithPulse" height="64" />
</p>

<h1 align="center">ZenithPulse</h1>

<p align="center">
  Autonomous risk enforcement and observability runtime for Bitget Playbooks.
</p>

<p align="center">
  <a href="https://zenithpulse-dashboard.vercel.app">Dashboard</a> · <a href="https://zenithpulse-server.onrender.com/api/health">Server</a> · <a href="https://zenithpulse-server.onrender.com/skill.md">SKILL.md</a> · <a href="https://www.npmjs.com/package/zenithpulse-mcp">npm</a>
</p>

ZenithPulse monitors live trading strategies against their own backtest rules — detects when they drift, scores the risk, enforces automatically, and records every decision.

**Built for:** Bitget AI Base Camp S1 — Track 2 (Trading Infra)

---

## Problem

You backtest a strategy on Bitget — it promises max 12% drawdown, only trades BTC/ETH, stays within margin. You deploy it as a Playbook. Now nothing monitors whether it actually follows those rules. It can drift, trade unauthorized assets, blow past drawdown limits — and you don't know until capital is lost.

## Solution

| Component | What it does |
|---|---|
| **Backtest-as-policy** | Reads your backtest results and turns them into rules automatically |
| **Drift engine** | Polls live state every 15s, catches when it breaks the rules |
| **Risk scoring** | Scores how dangerous the current state is (0–100) |
| **Reactive enforcement** | Cancels orders, closes positions when risk is critical |
| **Decision trace** | Records exactly what happened and why — full audit trail |
| **Alerts** | Real-time SSE events + dashboard notifications on violations |

Deploy a Playbook, connect ZenithPulse — monitoring starts in under 5 minutes with zero configuration.

### The Loop

Every 15 seconds, ZenithPulse runs this cycle autonomously:

```
  Watch → Detect → Score → Act → Record
    ↑                              │
    └──────────────────────────────┘
```

1. **Watch** — poll live positions, orders, balance from Bitget
2. **Detect** — compare against the rules derived from backtest
3. **Score** — compute risk 0–100 (how far from safe?)
4. **Act** — if in enforce mode and risk is critical: cancel orders / close positions
5. **Record** — log exactly what happened and why (decision trace)

---

## Bitget Products Integrated

| Product | Usage |
|---|---|
| **`bitget-core`** (Agent Hub) | Live state reads (positions, orders, balance) + enforcement writes on USDT-margined perpetual futures |
| **`getagent-skill`** (Playbook API) | Backtest metrics for behavioral contract derivation |

---

## Agent Integration

ZenithPulse is agent infrastructure. The primary consumer is your AI agent — a trading agent, portfolio manager, or any autonomous system running Bitget Playbooks.

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
      "args": ["-y", "zenithpulse-mcp"],
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

```bash
curl https://zenithpulse-server.onrender.com/api/health
curl https://zenithpulse-server.onrender.com/api/playbooks
curl -X PATCH https://zenithpulse-server.onrender.com/api/playbooks/{id}/mode \
  -H "Content-Type: application/json" -d '{"mode": "enforce"}'
```

---

## Try It Now

The server is running live — no setup needed to explore:

```bash
# Check health + observer state
curl https://zenithpulse-server.onrender.com/api/health

# List monitored playbooks with risk state
curl https://zenithpulse-server.onrender.com/api/playbooks

# View recent decision traces (full audit trail)
curl https://zenithpulse-server.onrender.com/api/traces?limit=3

# Read the machine-readable skill definition
curl https://zenithpulse-server.onrender.com/skill.md
```

Or run the demo script locally:

```bash
bun examples/demo-flow.ts
```

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

### Docker

```bash
docker compose up
```

### Commands

```bash
bun run dev          # Start server + dashboard
bun run build        # Build all packages
bun run check        # Biome lint + format check
bun run test         # Run test suite
bun run typecheck    # TypeScript type checking
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
│                     │  SSE Alerts  │    │   Hono REST API      │    │
│                     │  + Dashboard │    │   + MCP Endpoint     │    │
│                     └──────────────┘    └──────────┬───────────┘    │
│                                                     │                │
└─────────────────────────────────────────────────────┼────────────────┘
                                                      │
                                              ┌───────v───────┐
                                              │  Next.js      │
                                              │  Dashboard    │
                                              └───────────────┘
```

### Operating Modes

| Mode | Detection | Alerting | Enforcement |
|---|---|---|---|
| `enforce` | Active | Active | Active — cancels orders, closes positions |
| `observe` | Active | Active | Disabled — alerts only, no write actions |
| `silent` | Active | Disabled | Disabled — logs only, no alerts |

Default: `observe`. Switchable per-playbook at runtime via API or dashboard.

### Risk Scoring

Composite score (0–100) using max-of-weighted-factors:

```
risk_score = max(
  drawdown_proximity   * 40,
  asset_drift_count    * 25,
  oversize_ratio       * 20,
  sharpe_degradation   * 15
)
```

| Score | State | Meaning |
|---|---|---|
| 0–39 | `healthy` | Within backtest envelope |
| 40–69 | `elevated` | Approaching contract bounds |
| 70–100 | `critical` | Breach — enforcement fires in enforce mode |

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
| Bitget Dashboard | Manual portfolio view | Per-Playbook risk score, automated enforcement feed |

Nothing in the current Bitget stack derives rules from backtest, continuously monitors against them, scores risk, acts on violations, and produces a decision trace. ZenithPulse is additive — it consumes existing APIs and adds the behavioral contract + drift + enforcement + trace layer.

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
├── examples/            # Runnable demo scripts + captured session output
├── SKILL.md             # Machine-readable skill definition
├── server.json          # MCP Registry entry
├── Dockerfile           # Production container
├── docker-compose.yml   # Self-hosted deployment
└── render.yaml          # Render cloud deployment
```

---

## License

MIT

---

<sub>Bitget AI Base Camp S1 — Track 2 (Trading Infra)</sub>
