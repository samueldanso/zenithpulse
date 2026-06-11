# Plan: ZenithPulse Implementation

## Build Order

The system has clear dependency layers. Bottom-up build — each layer only depends on layers below it.

```
Layer 0: Monorepo scaffold + tooling + shared types
Layer 1: Bitget API client + Playbook API client
Layer 2: Behavioral contract derivation
Layer 3: Observer loop + live state polling
Layer 4: Drift detection + risk scoring
Layer 5: Enforcement engine
Layer 6: Decision trace + audit log (SQLite)
Layer 7: Telegram alerts
Layer 8: Hono API (REST + SSE)
Layer 9: Next.js dashboard
```

---

## Phase Breakdown

### Phase 1: Foundation (Day 1–2)

**Goal:** Monorepo builds, types compile, Bitget API calls work.

| Step | What | Depends on | Verification |
|---|---|---|---|
| 1.1 | Monorepo scaffold: root package.json, workspaces, biome, tsconfig | Nothing | `bun install` succeeds, `bun run check` passes |
| 1.2 | Shared types package (`@zenithpulse/shared`) | 1.1 | `bun run typecheck` passes |
| 1.3 | Server package scaffold (Hono hello world) | 1.1 | `bun run --filter @zenithpulse/server dev` → responds on :3001 |
|| 1.4 | Bitget API client wrapper (import `bitget-core`, typed calls) | 1.1, 1.2 | Unit test: call `futures_get_positions` for USDT-FUTURES → returns positions array |
| 1.5 | Playbook API client (HTTP to getagent-skill endpoints) | 1.1, 1.2 | Mock test: given API response → parsed into typed struct |
| 1.6 | SQLite + Drizzle setup (schema, migrations, connection) | 1.3 | `bun run --filter @zenithpulse/server test` → tables created |
| 1.7 | Environment config with Zod validation | 1.3 | Missing required env vars → clear error message |

**Checkpoint:** Server starts, Bitget client fetches live BTC price, DB has tables.

---

### Phase 2: Contract + Observer (Day 3–4)

**Goal:** Derive a behavioral contract from backtest data, poll live state.

| Step | What | Depends on | Verification |
|---|---|---|---|
| 2.1 | Contract derivation logic (`derive.ts`) | 1.5, 1.2 | Unit test: given backtest response → produces valid BehavioralContract |
| 2.2 | Contract persistence (store/load from SQLite) | 1.6, 2.1 | Integration test: derive → store → load → matches |
| 2.3 | Live state poller (account, orders, tickers → LiveState) | 1.4 | Integration test: poller returns well-typed LiveState from Bitget |
| 2.4 | Observer loop orchestrator (timer, state machine) | 2.3 | Runs N cycles, emits snapshots at configured interval |
| 2.5 | Mock backtest data for demo (until Playbook key arrives) | 2.1 | Contract derives from mock data matching `btc-ema-cross-demo` shape |

**Checkpoint:** Start server → contract derived (from mock) → observer loop polls live data every 15s → state snapshots logged to console.

---

### Phase 3: Drift + Risk Scoring (Day 4–5)

**Goal:** Compare live state against contract, compute risk score.

| Step | What | Depends on | Verification |
|---|---|---|---|
| 3.1 | Drift detection rules (one function per rule) | 2.1, 2.3 | Unit tests: each rule returns pass/warn/violation for known inputs |
| 3.2 | Drift orchestrator (run all rules, collect DriftResult[]) | 3.1 | Unit test: given LiveState + Contract → correct DriftResult set |
| 3.3 | Risk score computation (formula from spec) | 3.2 | Unit test: score=0 when all pass, score≥70 on drawdown breach |
| 3.4 | Risk state derivation (healthy/elevated/critical) | 3.3 | Unit test: thresholds map correctly |
| 3.5 | Integrate into observer loop (detect → score per cycle) | 2.4, 3.2, 3.3 | Observer logs risk score per cycle, correct values |

**Checkpoint:** Observer detects simulated drift (manually place wrong-symbol order), risk score reflects it in logs.

---

### Phase 4: Enforcement (Day 5–6)

**Goal:** Cancel futures orders and close positions in enforce mode.

| Step | What | Depends on | Verification |
|---|---|---|---|
| 4.1 | Enforcement decision logic (given DriftResult + mode → action) | 3.2 | Unit test: violation + enforce → cancel. violation + observe → none |
|| 4.2 | Cancel futures order action (`futures_cancel_orders`) | 1.4 | Integration test: place + cancel a limit futures order in demo mode |
|| 4.3 | Cancel plan order action (futures plan orders) | 1.4 | Integration test: place + cancel a trigger order in demo mode |
|| 4.4 | Close position action (`futures_place_order` tradeSide:close) | 1.4 | Integration test: open small position → close in demo mode |
| 4.5 | Enforcement engine (orchestrate decision → action → result) | 4.1–4.4 | Integration: observer detects drift → enforcement fires → order gone |

**Checkpoint:** In enforce mode, place a limit order on wrong symbol → ZenithPulse cancels it within 30s. Logged.

---

### Phase 5: Decision Trace + Alerts (Day 6–7)

**Goal:** Every observation persisted with full trace. Telegram fires on violations.

| Step | What | Depends on | Verification |
|---|---|---|---|
| 5.1 | Decision trace builder (assemble full trace struct per cycle) | 3.2, 4.5 | Unit test: given inputs → complete DecisionTrace with reasoning |
| 5.2 | Trace persistence (write to SQLite) | 1.6, 5.1 | Integration: cycle runs → trace queryable from DB |
| 5.3 | Reasoning string generator (human-readable explanation) | 5.1 | Unit test: various drift scenarios → clear English explanation |
| 5.4 | Telegram bot setup (grammy, message formatting) | 1.7 | Send test message to configured chat ID |
| 5.5 | Alert trigger logic (when to alert based on mode + severity) | 5.1 | Unit test: enforce+violation → alert. silent+violation → no alert |
| 5.6 | Integrate alerts into observer loop | 5.4, 5.5 | Violation fires → Telegram message received |

**Checkpoint:** Full cycle runs: poll → detect → score → enforce → trace → alert. All persisted. Telegram received.

---

### Phase 6: API Layer (Day 7–8)

**Goal:** Hono serves REST endpoints + SSE stream for dashboard.

| Step | What | Depends on | Verification |
|---|---|---|---|
| 6.1 | Playbook routes (list, detail, mode switch) | 1.6 | `curl /api/playbooks` → JSON array of playbooks |
| 6.2 | Trace routes (list with pagination, detail) | 5.2 | `curl /api/traces?playbook_id=X` → paginated traces |
| 6.3 | SSE event stream | 5.2 | Connect SSE → observer cycle emits event → client receives |
| 6.4 | Health endpoint | 1.3 | `curl /api/health` → `{ status: "ok", uptime, lastCycle }` |
| 6.5 | Mode switch endpoint | 1.6 | `PATCH /api/playbooks/:id/mode` → mode updates, next cycle uses it |

**Checkpoint:** All API endpoints respond correctly. SSE streams live data. Mode switching works via curl.

---

### Phase 7: Dashboard (Day 8–10)

**Goal:** Next.js app shows real-time portfolio state, per-Playbook detail, traces.

| Step | What | Depends on | Verification |
|---|---|---|---|
| 7.1 | Dashboard scaffold (Next.js + Tailwind + shadcn) | 1.1 | `bun run --filter @zenithpulse/dashboard dev` → renders on :3000 |
| 7.2 | API client + SSE hook | 6.1–6.3 | Fetches data from server, updates on SSE events |
| 7.3 | Portfolio page (all Playbooks, aggregate risk) | 7.2 | Shows playbook list with risk scores, updates live |
| 7.4 | Playbook detail page (contract, drift state, score, actions) | 7.2 | Shows derived contract rules + current state comparison |
| 7.5 | Decision trace feed (filterable log) | 7.2 | Shows traces with reasoning, filterable by action type |
| 7.6 | Mode switcher component | 6.5 | Toggle mode → server confirms → UI reflects |
| 7.7 | Risk score gauge + severity badges | 7.3 | Visual indicator updates in real time |

**Checkpoint:** Dashboard shows live data. Mode switch works. Enforcement actions appear in trace feed within seconds. Ready for 3-minute demo recording.

---

## Parallelizable Work

| Can build in parallel | Reason |
|---|---|
| 1.4 (Bitget client) + 1.5 (Playbook client) + 1.6 (DB setup) | No interdependencies |
| 3.1–3.4 (drift rules + scoring) | All pure functions, unit-testable in isolation |
| 5.4 (Telegram bot) + 5.1 (trace builder) | Independent subsystems |
| 7.x (dashboard) + 6.x (API) | Dashboard can mock API during development |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Playbook API key never arrives | Cannot derive real contract | Mock data ready from Phase 2 (step 2.5). Demo still works. |
| Demo API key not available | Cannot test enforcement safely | Test with live key using tiny limit orders far from market price (will never fill). Cancel immediately. |
| `drizzle-orm/bun-sqlite` has bugs | DB operations fail | Fallback: use `better-sqlite3` with Drizzle. Same schema, different driver — only if `bun:sqlite` proves unstable. |
| `bitget-core` source import has issues | Can't call Bitget API | Fallback: write thin REST client directly (HMAC signing is documented in bitget-core source). |
| Dashboard takes too long | Not ready for demo | Prioritize: trace feed + risk score + mode switcher only. Skip portfolio page if needed. |
| Rate limiting in demo | Observer gets throttled | Increase poll interval to 30s for demo. Batch reads where possible. |

---

## Timeline (15 days: Jun 10 → Jun 25)

| Days | Phase | Deliverable |
|---|---|---|
| 1–2 | Foundation | Monorepo builds, Bitget client works, DB ready |
| 3–4 | Contract + Observer | Contract derives, observer polls live data |
| 4–5 | Drift + Scoring | Drift detected, risk scored per cycle |
| 5–6 | Enforcement | Futures orders cancelled, positions closed |
| 6–7 | Trace + Alerts | Full audit log, Telegram alerts |
| 7–8 | API + MCP | REST + SSE + MCP server (5 tools) |
| 8–10 | Dashboard | Real-time UI, mode switching (configurable API_URL) |
| 10–11 | Deploy | Dockerfile + docker-compose + Render + Vercel |
| 11–12 | Integration + SKILL.md | End-to-end on deployed infra, skill.md at live URL |
| 13–14 | Demo recording | 3-minute video on live deployed instance |
| 15 | Submission | README with live URLs + deploy button, submit |

**Buffer:** 2 days of overlap between phases. If any phase takes an extra day, timeline still holds.

---

## Deployment Architecture (Locked)

This is production infra, not a local demo. Judges have 500 submissions — they click URLs.

```
┌─────────────────────────────┐     ┌──────────────────────────┐
│  Render (always-on worker)  │     │  Vercel (static deploy)  │
│                             │     │                          │
│  Hono Server (:3001)        │◀────│  Next.js Dashboard       │
│  Observer Loop (15s poll)   │     │  (NEXT_PUBLIC_API_URL)   │
│  MCP Server                 │     │                          │
│  GET /skill.md              │     └──────────────────────────┘
│  SQLite on persistent disk  │
│  /data/zenithpulse.db       │
└─────────────────────────────┘
         ▲
         │ MCP (stdio or HTTP)
         │
┌────────┴────────┐
│ Developer's IDE │
│ Claude / Cursor │
└─────────────────┘
```

| Component | Deploy to | Config |
|---|---|---|
| Server + Observer + MCP | Render (persistent disk) | `render.yaml`, Bun runtime |
| Dashboard | Vercel | `vercel.json`, `NEXT_PUBLIC_API_URL` |
| Self-hosted | Docker Compose | `docker-compose.yml` at root |
| SKILL.md | Served from Render URL | `GET /skill.md` (no auth) |

**Critical constraints:**
- Dashboard: `NEXT_PUBLIC_API_URL` env var (never hardcode localhost)
- Server: bind `0.0.0.0` (not just localhost)
- DB: `DB_PATH=/data/zenithpulse.db` (Render persistent disk mount)

---

## Verification Checkpoints (must pass before advancing)

| After Phase | Must demonstrate |
|---|---|
| 1 | `bun run dev` starts server. Bitget API call returns data. DB tables exist. |
| 2 | Contract derived from mock. Observer loop running at 15s interval. |
| 3 | Drift detected for known violation. Risk score correct per formula. |
| 4 | Enforcement cancels a real limit order in ≤30s. |
| 5 | Full trace in SQLite. Telegram alert received. |
| 6 | All API endpoints respond. SSE streams events. MCP tools callable. |
| 7 | Dashboard renders live data. Demo scenario executable. |
| 8 | `docker compose up` → full stack runs. Render/Vercel URLs live. |
| 9 | Demo video recorded on deployed instance. README has live URL badge. |
