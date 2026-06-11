# ZenithPulse — Session Notes

## Last session: T1–T7 complete

### State as of sign-off
- **Branch:** `main`
- **Tests:** 105/105 passing
- **Biome:** 86 files clean
- **Typecheck:** all 3 packages pass (`shared`, `server`, `dashboard`)
- **Build:** `packages/dashboard` production build passes

### What's done (T1–T7)

| Phase | Tasks | What shipped |
|-------|-------|-------------|
| T1 | 1–6 | Shared types, Drizzle schema, Bitget client, Playbook API client, health endpoint |
| T2 | 7–10 | Contract derivation, persistence, live state poller, observer loop |
| T3 | 11–13 | Drift detection, risk scoring |
| T4 | 14–16 | Enforcement decision engine + action executor |
| T5 | 17–19 | Decision trace builder, persistence, observer integration |
| T6 | 22–25 | REST API: playbooks, traces, SSE `/api/events`, enhanced health |
| T7 | 26–29 | Dashboard: portfolio overview, playbook detail, trace feed, live SSE updates |

### What's next (resume here)

**T8 — Telegram alerts (Tasks 20–21)**
- `packages/server/src/telegram/` — grammy bot already installed
- Alert on enforcement fired + daily risk summary
- Wire into observer loop after enforcement cycle
- Env vars: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (already in .env.example)

**T9 — MCP server (Tasks 30–31, Phase 8)**
- 4–5 tools: `get_playbook_status`, `list_traces`, `set_mode`, `get_live_state`
- Use `@modelcontextprotocol/sdk` in packages/server
- Mount as `/mcp` on Hono app

**T10 — skill.md endpoint (Task 32)**
- `GET /skill.md` on Hono — static markdown served as text/plain
- Describes the MCP tools + how to connect
- Reference: https://api.usezenithpay.xyz/skill.md (from ZenithPay)

**T11 — Docker + deployment (Tasks 33–35)**
- `Dockerfile` at repo root for server (Bun, multistage)
- `docker-compose.yml` — server + dashboard, volume for SQLite at `/data`
- `render.yaml` — server as web service, persistent disk
- `vercel.json` — dashboard deploy config
- `.env.example` cleanup

**T12 — README + demo video**
- Live URL badge + architecture diagram
- `docker compose up` quickstart
- Submission write-up

### Key constraints (don't forget)
- **No Next.js API routes** — all API in Hono (`packages/server`)
- **TanStack Query v5** for dashboard fetching
- **Drizzle config** at `packages/server/drizzle.config.ts`
- **Enforcement default mode:** `observe` — `enforce` requires explicit opt-in
- **No `as any`** — biome-ignore with comment if truly unavoidable
- **No feature branches** — stay on `main`
- **Commit style:** `type(scope): description`, max 72 chars, imperative

### Deployment plan (locked)
- Render → `packages/server` (persistent disk for SQLite, always-on worker)
- Vercel → `packages/dashboard`
- Docker Compose → self-hosted path for judges

### Real Bitget API
- Playbook endpoint: `GET /api/v1/playbook/list` (NOT `/api/v1/getagent/playbooks`)
- Real playbook: `btc-enhanced-turtle-breakout`, BTCUSDT, `follow_trade` mode
- `official_metrics.summary.sharpe_ratio = 0.9949`, `max_drawdown_pct = 6.8478`, `margin_budget = 1000.0`
- `serenity-recommend-stock` is `signal_only` — enforcement disabled for it
