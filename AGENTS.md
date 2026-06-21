# AGENTS.md — ZenithPulse

This file provides context for any AI agent working with this codebase.

## What This Is

**ZenithPulse** is an autonomous risk enforcement and observability runtime for Bitget Playbooks. It monitors live trading strategies against their own backtest rules — detects when they drift, scores the risk, enforces automatically, and records every decision.

**Built for:** Bitget AI Base Camp S1 — Track 2 (Trading Infra)
**Live:** https://zenithpulse-server.onrender.com
**Dashboard:** https://zenithpulse-dashboard.vercel.app
**SKILL.md:** https://zenithpulse-server.onrender.com/skill.md

---

## Interact with ZenithPulse (for AI Agents)

If you are an AI agent reading this, you can query the live runtime directly.

### SKILL.md — Discoverable by Any Agent

```bash
curl https://zenithpulse-server.onrender.com/skill.md
```

### Connect via MCP

```json
{
	"mcpServers": {
		"zenithpulse": {
			"url": "https://zenithpulse-server.onrender.com/mcp"
		}
	}
}
```

MCP tools: `list_playbooks` · `get_risk_state` · `get_traces` · `switch_mode` · `get_health`

### REST API

```bash
curl https://zenithpulse-server.onrender.com/api/health
curl https://zenithpulse-server.onrender.com/api/playbooks
curl https://zenithpulse-server.onrender.com/api/traces?limit=5
curl https://zenithpulse-server.onrender.com/api/events          # SSE stream
```

---

## The Loop

Every 15 seconds, ZenithPulse runs this cycle autonomously:

```
  Watch → Detect → Score → Act → Record
    ↑                              │
    └──────────────────────────────┘
```

1. **Watch** — poll live positions, orders, balance from Bitget
2. **Detect** — compare against rules derived from backtest
3. **Score** — compute risk 0–100
4. **Act** — if mode=enforce and risk is critical: cancel orders / close positions
5. **Record** — log decision trace + emit SSE event

---

## Three Modes

| Mode      | Detection | Enforcement                               |
| --------- | --------- | ----------------------------------------- |
| `enforce` | Active    | Active — cancels orders, closes positions |
| `observe` | Active    | Disabled — traces + alerts only (default) |
| `silent`  | Active    | Disabled — logs only                      |

---

## Repo Structure

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
│   │       ├── mcp/         # MCP tool definitions
│   │       └── db/          # Drizzle schema + migrations
│   ├── mcp/             # Publishable MCP package (npx zenithpulse-mcp)
│   ├── dashboard/       # Next.js real-time monitoring UI
│   └── shared/          # Shared types + constants
├── examples/            # Runnable demo scripts + session capture
├── SKILL.md             # Machine-readable skill definition
├── AGENTS.md            # This file
└── CLAUDE.md            # Claude Code session instructions
```

---

## Key Files

| File                                     | Purpose                                   |
| ---------------------------------------- | ----------------------------------------- |
| `packages/server/src/observer/loop.ts`   | Main observer loop — the heartbeat        |
| `packages/server/src/observer/poller.ts` | Bitget API polling + state snapshot       |
| `packages/server/src/contract/derive.ts` | Backtest → behavioral contract derivation |
| `packages/server/src/drift/detect.ts`    | Drift detection rules                     |
| `packages/server/src/drift/score.ts`     | Risk scoring (0–100)                      |
| `packages/server/src/enforce/engine.ts`  | Enforcement decision logic                |
| `packages/server/src/enforce/actions.ts` | Bitget write actions (cancel/close)       |
| `packages/server/src/trace/store.ts`     | Decision trace persistence                |
| `packages/server/src/api/router.ts`      | API routes + MCP endpoint                 |
| `packages/server/src/config.ts`          | Environment config + validation           |
| `packages/shared/src/types.ts`           | All shared types                          |

---

## Import Direction

```
api/  →  observer/  →  drift/  →  enforce/  →  trace/
                    →  contract/
                    →  bitget/

packages/shared  →  imported by all, imports nothing from server/
```

---

## Bitget Integration

| API                     | Module                   | Usage                                                |
| ----------------------- | ------------------------ | ---------------------------------------------------- |
| `bitget-core` (futures) | `bitget/client.ts`       | Read positions, orders, balance + write cancel/close |
| `getagent-skill`        | `bitget/playbook-api.ts` | Fetch Playbook backtest metrics                      |

Auth: `ACCESS-KEY` header for Playbook API, HMAC signature for trading API.

---

## Dev Commands

```bash
bun install
bun run dev          # server :3001 + dashboard :3000
bun run check        # biome lint + format
bun run test         # vitest
bun run typecheck    # tsc --noEmit
```

---

## Hard Rules

1. Never place buy orders — ZenithPulse only cancels orders or closes positions
2. Default mode is `observe` — enforcement requires explicit opt-in
3. `signal_only` Playbooks → enforcement disabled, observability stays active
4. Every enforcement action must produce a decision trace
5. Perpetual futures only (USDT-margined) — no spot
6. No `as any`, `@ts-ignore`, `@ts-expect-error`

---

## Deployment

| Component         | Platform                                    | URL                                      |
| ----------------- | ------------------------------------------- | ---------------------------------------- |
| Server + Observer | Render (Docker, persistent disk at `/data`) | https://zenithpulse-server.onrender.com  |
| Dashboard         | Vercel (Next.js)                            | https://zenithpulse-dashboard.vercel.app |
