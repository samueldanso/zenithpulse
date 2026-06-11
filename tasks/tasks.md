# Implementation Tasks: ZenithPulse

## Overview

Vertical-slice task breakdown following the implementation plan. Each task leaves the system in a working state. Tasks are sized S–M (1–5 files each).

---

## Phase 1: Foundation

### Task 1: Monorepo scaffold + tooling

**Description:** Set up Bun workspace root with three packages (server, dashboard, shared). Configure biome, tsconfig, and root scripts.

**Acceptance criteria:**
- [x] `bun install` succeeds with no errors
- [x] `bun run check` (biome) passes
- [x] `bun run typecheck` passes
- [x] Three workspace packages resolve each other

**Verification:**
- `bun install && bun run check && bun run typecheck`

**Dependencies:** None

**Files:**
- `package.json` (root)
- `biome.json`
- `tsconfig.json`
- `packages/server/package.json`
- `packages/server/tsconfig.json`
- `packages/dashboard/package.json`
- `packages/dashboard/tsconfig.json`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `.env.example`
- `.gitignore`

**Scope:** M

---

### Task 2: Shared types package

**Description:** Define all shared types in `@zenithpulse/shared` — BehavioralContract, LiveState, DriftResult, DecisionTrace, OperatingMode, RiskState, constants.

**Acceptance criteria:**
- [x] All types from spec's "Key Types" section exist
- [x] Constants for modes and risk thresholds exported
- [x] Package importable from server and dashboard
- [x] `bun run typecheck` passes

**Verification:**
- `bun run typecheck`

**Dependencies:** Task 1

**Files:**
- `packages/shared/src/types.ts`
- `packages/shared/src/constants.ts`
- `packages/shared/src/index.ts`

**Scope:** S

---

### Task 3: Server scaffold (Hono hello world + config)

**Description:** Set up Hono server with env config (Zod-validated), health endpoint, and dev script. Server starts on port 3001.

**Acceptance criteria:**
- [x] `bun run --filter @zenithpulse/server dev` starts server
- [x] `GET /api/health` returns `{ status: "ok" }`
- [x] Missing required env vars produce clear error
- [x] Config loads from `.env` with Zod validation

**Verification:**
- Start server → `curl http://localhost:3001/api/health`

**Dependencies:** Task 1

**Files:**
- `packages/server/src/index.ts`
- `packages/server/src/config.ts`
- `packages/server/src/api/routes.ts`

**Scope:** S

---

### Task 4: SQLite + Drizzle schema and connection

**Description:** Set up Drizzle ORM with `bun:sqlite` driver. Define `playbooks` and `traces` tables from spec. Auto-migrate on startup.

**Acceptance criteria:**
- [x] DB file created at configured path on first start
- [x] Both tables exist with correct columns and indexes
- [x] `db` client singleton exportable for use in other modules
- [x] Migration runs idempotently (safe to restart)

**Verification:**
- Start server → check `data/zenithpulse.db` exists → query `sqlite3 data/zenithpulse.db ".tables"`

**Dependencies:** Task 3

**Files:**
- `packages/server/src/db/schema.ts`
- `packages/server/src/db/client.ts`
- `packages/server/src/db/migrate.ts`

**Scope:** S

---

### Task 5: Bitget API client wrapper

**Description:** Import `bitget-core` from `.resources/agent_hub` and wrap it in a typed client. Exposes read methods (futures positions, open orders, plan orders, account balance) and write methods (cancel futures order, cancel plan order, close position via tradeSide:close). All calls target USDT-margined perpetual futures (`productType: USDT-FUTURES`).

**Acceptance criteria:**
- [x] Client initializes with API key/secret/passphrase from config
- [x] `getFuturesPositions("USDT-FUTURES")` returns typed positions array
- [x] `cancelFuturesOrder(symbol, orderId)` calls `futures_cancel_orders` endpoint
- [x] `closeFuturesPosition(symbol, size)` places `futures_place_order` with `tradeSide: "close"`
- [x] Paper-trading mode flag routes to demo base URL
- [x] All write methods typed and callable

**Verification:**
- Unit test: mock responses → typed outputs
- Integration (manual, paper mode): `getFuturesPositions` returns positions array

**Dependencies:** Task 3

**Files:**
- `packages/server/src/bitget/client.ts`
- `packages/server/tests/bitget/client.test.ts`

**Scope:** S

---

### Task 6: Playbook API client (getagent-skill)

**Description:** HTTP client for `getagent-skill` API. Implements `listPlaybooks()` and `getPlaybookRun(runId)`. Returns typed backtest metrics. Includes mock fallback when `PLAYBOOK_ACCESS_KEY` is not set.

**Acceptance criteria:**
- [x] `listPlaybooks()` returns typed array with `trading_symbols`, `official_metrics`
- [x] When access key is missing, returns mock data matching `btc-ema-cross-demo` shape
- [x] Zod validates API responses at boundary
- [x] Mock mode clearly logged on startup

**Verification:**
- Unit test: mock API response → valid typed output
- Unit test: missing key → mock data returned

**Dependencies:** Task 3

**Files:**
- `packages/server/src/bitget/playbook-api.ts`
- `packages/server/tests/contract/playbook-api.test.ts`

**Scope:** S

---

### Checkpoint: Foundation
- [x] `bun install && bun run check && bun run typecheck` passes
- [x] Server starts, health endpoint responds
- [x] DB tables exist
- [x] Bitget client fetches live ticker
- [x] Playbook client returns mock data

---

## Phase 2: Contract + Observer

### Task 7: Behavioral contract derivation

**Description:** Pure function that takes Playbook API response and produces a `BehavioralContract`. Maps each backtest field to a contract rule per FR-1 table in PRD.

**Acceptance criteria:**
- [x] Given `trading_symbols: ["BTCUSDT"]` → `allowedSymbols: ["BTCUSDT"]`
- [x] Given `max_drawdown_pct: 12.5` → `maxDrawdownPct: 12.5`
- [x] Given `sharpe_ratio: 1.8` → `backTestSharpe: 1.8`
- [x] All fields from spec's BehavioralContract populated
- [x] Invalid/missing backtest fields produce sensible defaults with warnings

**Verification:**
- `bun run --filter @zenithpulse/server test` — contract derivation tests pass

**Dependencies:** Task 2, Task 6

**Files:**
- `packages/server/src/contract/derive.ts`
- `packages/server/src/contract/schema.ts`
- `packages/server/tests/contract/derive.test.ts`

**Scope:** S

---

### Task 8: Contract persistence (store + load)

**Description:** Functions to save derived contract to SQLite `playbooks` table and load it. Upsert on re-derivation.

**Acceptance criteria:**
- [x] `saveContract(playbookId, contract)` persists to DB
- [x] `loadContract(playbookId)` returns deserialized BehavioralContract
- [x] Re-saving updates `contract_derived_at`
- [x] Returns null for unknown playbook ID

**Verification:**
- Integration test: save → load → matches original

**Dependencies:** Task 4, Task 7

**Files:**
- `packages/server/src/contract/store.ts`
- `packages/server/tests/contract/store.test.ts`

**Scope:** S

---

### Task 9: Live state poller

**Description:** Function that calls Bitget API and assembles a `LiveState` snapshot — account balance, open orders, plan orders, ticker prices, computed drawdown and exposure.

**Acceptance criteria:**
- [x] Returns valid `LiveState` struct with all fields populated
- [x] Computes `totalExposure` from open orders + positions
- [x] Computes `currentDrawdown` from peak balance vs current
- [x] Handles empty account (no orders, no positions) gracefully

**Verification:**
- Unit test: mocked API responses → correct LiveState assembly
- Integration (manual): returns real data from Bitget

**Dependencies:** Task 2, Task 5

**Files:**
- `packages/server/src/observer/poller.ts`
- `packages/server/src/observer/state.ts`
- `packages/server/tests/observer/poller.test.ts`

**Scope:** M

---

### Task 10: Observer loop orchestrator

**Description:** Timer-based loop that runs at configured interval (default 15s). Each cycle: poll → detect → score → enforce → trace → alert. This task wires the skeleton — detect/score/enforce/trace/alert are stubs that log and return defaults.

**Acceptance criteria:**
- [x] Loop starts on server boot
- [x] Runs at `POLL_INTERVAL_MS` interval
- [x] Each cycle calls poller → logs LiveState summary
- [x] Graceful shutdown on process exit
- [x] Skips cycle if previous is still running (no overlap)

**Verification:**
- Start server → see polling logs every 15s → stop → clean exit

**Dependencies:** Task 9

**Files:**
- `packages/server/src/observer/loop.ts`
- `packages/server/src/index.ts` (wire loop startup)

**Scope:** S

---

### Checkpoint: Contract + Observer
- [x] Server starts → derives contract from mock data → observer polls every 15s
- [x] Logs show LiveState snapshots with real Bitget data
- [x] Contract stored in SQLite and loadable

---

## Phase 3: Drift Detection + Risk Scoring

### Task 11: Drift detection rules

**Description:** Implement individual drift detection functions — one per rule: asset drift, position oversize, drawdown breach, unauthorized trade, Sharpe degradation. Each returns a `DriftResult`.

**Acceptance criteria:**
- [ ] `detectAssetDrift(contract, state)` → violation when order on non-allowed symbol
- [ ] `detectOversize(contract, state)` → violation when exposure > margin budget
- [ ] `detectDrawdownBreach(contract, state)` → violation when drawdown > max
- [ ] `detectSharpeDegradation(contract, state)` → warn when rolling < backtest
- [x] Each returns `pass` when within bounds

**Verification:**
- `bun run --filter @zenithpulse/server test` — all drift rule tests pass

**Dependencies:** Task 2

**Files:**
- `packages/server/src/drift/detect.ts`
- `packages/server/src/drift/types.ts`
- `packages/server/tests/drift/detect.test.ts`

**Scope:** M

---

### Task 12: Risk score computation

**Description:** Implement the `computeRiskScore` function from the spec. Takes contract + state, returns 0–100 score using max-of-weighted-factors formula.

**Acceptance criteria:**
- [x] Score = 0 when all rules pass (no drift)
- [x] Score ≥ 70 when drawdown at 100% of max (critical)
- [x] Score = 25 when one asset drifts but nothing else
- [x] Risk state maps correctly: 0–39 healthy, 40–69 elevated, 70–100 critical

**Verification:**
- Unit tests with known inputs → expected scores

**Dependencies:** Task 11

**Files:**
- `packages/server/src/drift/score.ts`
- `packages/server/tests/drift/score.test.ts`

**Scope:** S

---

### Task 13: Wire drift + scoring into observer loop

**Description:** Replace stub in observer loop with real drift detection and risk scoring. Each cycle now evaluates all rules and computes risk score. Update playbook risk state in DB.

**Acceptance criteria:**
- [x] Observer logs drift results per cycle
- [x] Risk score computed and logged
- [x] `playbooks` table updated with `risk_score` and `risk_state` each cycle
- [x] No enforcement yet (still stub)

**Verification:**
- Start server → manually check DB shows updating risk scores

**Dependencies:** Task 10, Task 11, Task 12, Task 8

**Files:**
- `packages/server/src/observer/loop.ts` (replace detect stub)
- `packages/server/src/db/queries.ts` (update risk state)

**Scope:** S

---

### Checkpoint: Drift + Scoring
- [x] Observer detects drift when state violates contract
- [x] Risk score reflects severity correctly
- [x] DB shows live risk state per playbook

---

## Phase 4: Enforcement

### Task 14: Enforcement decision logic

**Description:** Pure function: given `DriftResult[]` + `OperatingMode` → decide which enforcement actions to take. Returns action descriptors (what to cancel, what to close).

**Acceptance criteria:**
- [x] Mode = enforce + violation → returns action
- [x] Mode = observe + violation → returns `none`
- [x] Mode = silent + violation → returns `none`
- [x] Maps violation type to correct action (asset drift → cancel order, drawdown → close position)

**Verification:**
- Unit tests covering all mode × violation combinations

**Dependencies:** Task 2, Task 11

**Files:**
- `packages/server/src/enforce/engine.ts`
- `packages/server/src/enforce/types.ts`
- `packages/server/tests/enforce/engine.test.ts`

**Scope:** S

---

### Task 15: Enforcement actions (cancel + close position)

**Description:** Functions that execute enforcement via Bitget futures mix API — cancel order by ID (`futures_cancel_orders`), cancel plan order (futures plan), close position via market order (`futures_place_order` with `tradeSide: "close"`).

**Acceptance criteria:**
- [x] `cancelOrder(orderId, symbol)` calls `futures_cancel_orders` → returns success/fail
- [x] `cancelPlanOrder(orderId, symbol)` cancels futures plan (trigger) order
- [x] `closePosition(symbol, size)` places `futures_place_order` with `tradeSide: "close"` → closes position
- [x] All actions return structured result (success + orderId, or failed + error)

**Verification:**
- Unit test: mocked API → correct request params sent
- Integration (manual, demo mode): place limit order → cancel it

**Dependencies:** Task 5

**Files:**
- `packages/server/src/enforce/actions.ts`
- `packages/server/tests/enforce/actions.test.ts`

**Scope:** S

---

### Task 16: Wire enforcement into observer loop

**Description:** Replace enforcement stub in observer loop. After drift detection, if mode=enforce and violations exist, execute enforcement actions.

**Acceptance criteria:**
- [x] Enforcement fires only in `enforce` mode
- [x] Correct action type per violation (cancel order for asset drift, close position for drawdown)
- [x] Action result (success/fail) captured for trace
- [x] Observer loop continues even if enforcement fails

**Verification:**
- Integration: set mode=enforce → place wrong-symbol order → order cancelled within 30s

**Dependencies:** Task 13, Task 14, Task 15

**Files:**
- `packages/server/src/observer/loop.ts` (replace enforce stub)

**Scope:** S

---

### Checkpoint: Enforcement
- [x] In enforce mode: violating limit order cancelled automatically
- [x] In observe mode: violation detected but no action taken
- [x] Enforcement result captured (success/fail)

---

## Phase 5: Decision Trace + Alerts

### Task 17: Decision trace builder

**Description:** Function that assembles a complete `DecisionTrace` from cycle data — state snapshot, contract, drift results, risk score, enforcement action, and human-readable reasoning string.

**Acceptance criteria:**
- [x] Produces valid DecisionTrace with all fields from spec
- [x] Reasoning string is human-readable: "Detected ETHUSDT order — not in allowed set [BTCUSDT]. Risk score 25 (elevated). Action: cancelled order abc123."
- [x] Handles pass case: "All 4 rules passed. Risk score 0 (healthy). No action."

**Verification:**
- Unit tests: various scenarios → correct trace assembly + reasoning

**Dependencies:** Task 2

**Files:**
- `packages/server/src/trace/record.ts`
- `packages/server/src/trace/types.ts`
- `packages/server/tests/trace/record.test.ts`

**Scope:** S

---

### Task 18: Trace persistence

**Description:** Write decision trace to SQLite `traces` table after each cycle. Query functions for listing traces (paginated, filterable).

**Acceptance criteria:**
- [x] `saveTrace(trace)` persists to DB
- [x] `listTraces({ playbookId, limit, offset, action })` returns filtered results
- [x] `getTrace(id)` returns single trace with full detail
- [x] JSON fields (live_state, drift_results) round-trip correctly

**Verification:**
- Integration test: save → list → get → data matches

**Dependencies:** Task 4, Task 17

**Files:**
- `packages/server/src/trace/store.ts`
- `packages/server/tests/trace/store.test.ts`

**Scope:** S

---

### Task 19: Wire trace into observer loop

**Description:** After drift + enforcement in each cycle, build trace and persist it. Emit the trace for SSE and alerts.

**Acceptance criteria:**
- [x] Every cycle produces a trace in SQLite
- [x] Trace includes enforcement result if action was taken
- [x] Pass cycles also traced (full audit trail)

**Verification:**
- Start server → let run 3 cycles → query DB → 3 traces exist

**Dependencies:** Task 10, Task 17, Task 18

**Files:**
- `packages/server/src/observer/loop.ts` (replace trace stub)

**Scope:** S

---

### Task 20: Telegram bot setup + alert logic

**Description:** Set up grammy bot instance, alert formatting, and trigger logic. Alert fires on violations in enforce/observe mode (not silent).

**Acceptance criteria:**
- [ ] grammy bot connects and sends test message
- [ ] Alert message includes: playbook name, drift rule, risk score, action taken
- [ ] Alert fires on violation in enforce/observe mode
- [ ] No alert in silent mode
- [ ] Rate limiting: max 1 alert per playbook per 60s

**Verification:**
- Integration: trigger violation → Telegram message received

**Dependencies:** Task 17

**Files:**
- `packages/server/src/alert/telegram.ts`
- `packages/server/src/alert/trigger.ts`
- `packages/server/tests/alert/trigger.test.ts`

**Scope:** S

---

### Task 21: Wire alerts into observer loop

**Description:** Replace alert stub. After trace, evaluate alert trigger conditions and send Telegram notification.

**Acceptance criteria:**
- [ ] Alerts fire after trace is persisted
- [ ] Alert failure doesn't crash observer loop
- [ ] Alert includes trace ID for cross-reference

**Verification:**
- Start server → trigger violation → Telegram alert with trace link

**Dependencies:** Task 19, Task 20

**Files:**
- `packages/server/src/observer/loop.ts` (replace alert stub)

**Scope:** S

---

### Checkpoint: Decision Trace + Alerts
- [ ] Full cycle: poll → detect → score → enforce → trace → alert
- [ ] All traces in SQLite with reasoning
- [ ] Telegram alert received on violation

---

## Phase 6: API Layer

### Task 22: Playbook REST routes

**Description:** Hono routes for playbook CRUD — list all, get detail, switch mode.

**Acceptance criteria:**
- [ ] `GET /api/playbooks` → JSON array with risk state
- [ ] `GET /api/playbooks/:id` → single playbook with contract
- [ ] `PATCH /api/playbooks/:id/mode` → updates mode (validate against enum)
- [ ] Error responses use consistent shape `{ error: string }`

**Verification:**
- curl all three endpoints → correct responses

**Dependencies:** Task 4, Task 8

**Files:**
- `packages/server/src/api/routes/playbooks.ts`
- `packages/server/tests/api/playbooks.test.ts`

**Scope:** S

---

### Task 23: Trace REST routes

**Description:** Routes for querying decision traces — list (paginated, filterable) and detail.

**Acceptance criteria:**
- [ ] `GET /api/traces?playbook_id=X&limit=50&offset=0` → paginated traces
- [ ] `GET /api/traces/:id` → single trace with full detail
- [ ] Filter by action type (none, cancel_order, close_position)
- [ ] Returns total count for pagination

**Verification:**
- curl with filters → correct results

**Dependencies:** Task 18

**Files:**
- `packages/server/src/api/routes/traces.ts`
- `packages/server/tests/api/traces.test.ts`

**Scope:** S

---

### Task 24: SSE event stream

**Description:** Server-Sent Events endpoint for real-time dashboard updates. Emits cycle events (risk score, drift, enforcement).

**Acceptance criteria:**
- [ ] `GET /api/events` → SSE connection
- [ ] Emits `cycle` event after each observer cycle (risk score, state, drift count)
- [ ] Emits `enforcement` event when action fires
- [ ] Connection heartbeat every 30s
- [ ] Multiple clients supported

**Verification:**
- Connect via curl → receive events as cycles run

**Dependencies:** Task 19

**Files:**
- `packages/server/src/api/routes/events.ts`
- `packages/server/src/api/emitter.ts`

**Scope:** S

---

### Task 25: Health + system info endpoint

**Description:** Enhanced health endpoint with uptime, last cycle time, active playbook count, observer state.

**Acceptance criteria:**
- [ ] `GET /api/health` → `{ status, uptime, lastCycleAt, playbookCount, observerRunning }`
- [ ] Returns 200 when observer running, 503 if not started

**Verification:**
- curl → matches server state

**Dependencies:** Task 3

**Files:**
- `packages/server/src/api/routes/health.ts` (update existing)

**Scope:** S

---

### Checkpoint: API Layer
- [ ] All REST endpoints respond with correct data
- [ ] SSE streams live cycle events
- [ ] Mode switch persists and takes effect next cycle

---

## Phase 7: Dashboard

### Task 26: Dashboard scaffold + API client

**Description:** Next.js 16 app with Tailwind v4, shadcn/ui, configurable API_URL. API client using fetch + SSE hook.

**Acceptance criteria:**
- [ ] `bun run --filter @zenithpulse/dashboard dev` → renders on :3000
- [ ] `NEXT_PUBLIC_API_URL` env var used for all API calls (NOT hardcoded)
- [ ] SSE hook connects and receives events
- [ ] Basic layout (header, sidebar placeholder)

**Verification:**
- Start dashboard → connects to server → no console errors

**Dependencies:** Task 22, Task 24

**Files:**
- `packages/dashboard/src/lib/api.ts`
- `packages/dashboard/src/hooks/use-events.ts`
- `packages/dashboard/src/app/layout.tsx`
- `packages/dashboard/src/app/page.tsx`

**Scope:** M

---

### Task 27: Portfolio page (all playbooks)

**Description:** Main page showing all monitored playbooks with live risk scores, modes, and aggregate status.

**Acceptance criteria:**
- [ ] Lists all playbooks with name, risk score, risk state badge, mode
- [ ] Risk score updates via SSE (no page refresh)
- [ ] Color-coded risk badges (green/yellow/red)
- [ ] Click playbook → navigates to detail

**Verification:**
- Dashboard shows playbooks → risk updates live

**Dependencies:** Task 26

**Files:**
- `packages/dashboard/src/app/page.tsx`
- `packages/dashboard/src/components/playbook-card.tsx`
- `packages/dashboard/src/components/risk-badge.tsx`

**Scope:** S

---

### Task 28: Playbook detail page

**Description:** Shows behavioral contract rules, current drift state, risk gauge, mode switcher, and recent traces.

**Acceptance criteria:**
- [ ] Displays contract rules (allowed assets, max drawdown, max exposure, min sharpe)
- [ ] Shows current violations highlighted
- [ ] Risk score gauge (visual)
- [ ] Mode switcher (enforce/observe/silent) with API call
- [ ] Recent traces list (last 10)

**Verification:**
- Navigate to playbook → all data renders → switch mode → persists

**Dependencies:** Task 27

**Files:**
- `packages/dashboard/src/app/playbooks/[id]/page.tsx`
- `packages/dashboard/src/components/risk-gauge.tsx`
- `packages/dashboard/src/components/mode-switcher.tsx`
- `packages/dashboard/src/components/contract-rules.tsx`

**Scope:** M

---

### Task 29: Decision trace feed

**Description:** Filterable feed of decision traces showing reasoning, actions, timestamps.

**Acceptance criteria:**
- [ ] Lists traces with timestamp, playbook, risk score, action, reasoning snippet
- [ ] Filter by playbook, action type
- [ ] Click → expand to full reasoning + state snapshot
- [ ] New traces appear via SSE (no refresh)

**Verification:**
- Traces page → shows history → filter works → new trace appears live

**Dependencies:** Task 26

**Files:**
- `packages/dashboard/src/app/traces/page.tsx`
- `packages/dashboard/src/components/trace-item.tsx`

**Scope:** M

---

### Checkpoint: Dashboard
- [ ] Dashboard renders live data from server
- [ ] Risk scores update without refresh
- [ ] Mode switching works end-to-end
- [ ] Trace feed shows enforcement actions

---

## Phase 8: MCP Server + SKILL.md

### Task 30: MCP server (5 tools)

**Description:** Model Context Protocol server exposing ZenithPulse tools for Claude/Cursor integration. Tools: list_playbooks, get_risk_state, get_traces, switch_mode, get_health.

**Acceptance criteria:**
- [ ] MCP server starts alongside Hono (same process)
- [ ] 5 tools callable via MCP protocol
- [ ] Tools return structured JSON (not prose)
- [ ] Works with Claude Desktop / Cursor MCP config

**Verification:**
- Connect via MCP inspector → call each tool → correct response

**Dependencies:** Task 22, Task 23, Task 25

**Files:**
- `packages/server/src/mcp/server.ts`
- `packages/server/src/mcp/tools.ts`

**Scope:** M

---

### Task 31: SKILL.md endpoint

**Description:** Serve agent-readable skill manifest at `GET /skill.md`. Describes capabilities, available tools, and MCP connection config.

**Acceptance criteria:**
- [ ] `GET /skill.md` → returns markdown (content-type text/markdown)
- [ ] Describes what ZenithPulse does (1 paragraph)
- [ ] Lists available tools with params
- [ ] Includes MCP config JSON block (pointing to deployed URL)
- [ ] No auth required

**Verification:**
- curl /skill.md → readable skill manifest with correct MCP config

**Dependencies:** Task 30

**Files:**
- `packages/server/src/api/routes/skill.ts`
- `packages/server/src/api/skill-content.ts`

**Scope:** S

---

### Checkpoint: MCP + SKILL.md
- [ ] MCP tools callable from Claude/Cursor
- [ ] SKILL.md served at /skill.md
- [ ] MCP config in SKILL.md points to live URL

---

## Phase 9: Deployment

### Task 32: Dockerfile + docker-compose

**Description:** Multi-stage Dockerfile for server (Bun runtime). Docker Compose file at root with server + persistent volume for SQLite.

**Acceptance criteria:**
- [ ] `docker compose up` → full server running, observer loop active
- [ ] SQLite DB persisted to volume (survives restart)
- [ ] Health endpoint responds from container
- [ ] `.env.example` documents all required vars
- [ ] Image size < 200MB

**Verification:**
- `docker compose up` → curl health → data persists after restart

**Dependencies:** Task 25

**Files:**
- `Dockerfile`
- `docker-compose.yml`
- `.env.example` (update)

**Scope:** M

---

### Task 33: Render deploy config

**Description:** `render.yaml` blueprint for one-click Render deploy. Persistent disk for SQLite, env vars from Render dashboard.

**Acceptance criteria:**
- [ ] `render.yaml` at repo root with web service config
- [ ] Bun runtime, `bun run start` command
- [ ] Persistent disk at `/data` (1GB)
- [ ] Env vars listed (secretKeys for API keys)
- [ ] Health check path configured
- [ ] Deploy succeeds → server live at Render URL

**Verification:**
- Push → Render auto-deploys → health endpoint responds at public URL

**Dependencies:** Task 32

**Files:**
- `render.yaml`
- `packages/server/package.json` (add `start` script)

**Scope:** S

---

### Task 34: Vercel deploy config

**Description:** `vercel.json` for dashboard deploy. NEXT_PUBLIC_API_URL points to Render server URL.

**Acceptance criteria:**
- [ ] `vercel.json` at `packages/dashboard/` or root
- [ ] Dashboard builds and deploys on Vercel
- [ ] `NEXT_PUBLIC_API_URL` env var set to Render URL
- [ ] Dashboard live at Vercel URL → fetches data from server

**Verification:**
- Push → Vercel auto-deploys → dashboard loads → shows live data from Render server

**Dependencies:** Task 33, Task 26

**Files:**
- `packages/dashboard/vercel.json` or root `vercel.json`

**Scope:** S

---

### Task 35: README with live URLs + deploy buttons

**Description:** Production README with architecture diagram, live URL badges, one-click deploy buttons, quickstart, and demo video embed.

**Acceptance criteria:**
- [ ] Problem → architecture diagram → live URLs (badge format)
- [ ] "Deploy to Render" button + "Deploy to Vercel" button
- [ ] Quickstart: clone → `docker compose up` → running in 30s
- [ ] Tech stack list
- [ ] MCP config block (copy-paste into Claude/Cursor)
- [ ] Demo video embed (placeholder until recorded)
- [ ] `.env.example` referenced with all vars documented

**Verification:**
- README renders on GitHub → all links work → deploy buttons configured

**Dependencies:** Task 33, Task 34

**Files:**
- `README.md`

**Scope:** M

---

### Checkpoint: Deployment
- [ ] `docker compose up` → full stack runs locally
- [ ] Render URL live → health endpoint responds
- [ ] Vercel URL live → dashboard fetches from Render
- [ ] README has deploy buttons + live URL badges
- [ ] SKILL.md references deployed URL (not localhost)


