# Implementation Tasks: ZenithPulse

## Overview

Vertical-slice task breakdown following the implementation plan. Each task leaves the system in a working state. Tasks are sized S–M (1–5 files each).

---

## Phase 1: Foundation

### Task 1: Monorepo scaffold + tooling

**Description:** Set up Bun workspace root with three packages (server, dashboard, shared). Configure biome, tsconfig, and root scripts.

**Acceptance criteria:**
- [ ] `bun install` succeeds with no errors
- [ ] `bun run check` (biome) passes
- [ ] `bun run typecheck` passes
- [ ] Three workspace packages resolve each other

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
- [ ] All types from spec's "Key Types" section exist
- [ ] Constants for modes and risk thresholds exported
- [ ] Package importable from server and dashboard
- [ ] `bun run typecheck` passes

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
- [ ] `bun run --filter @zenithpulse/server dev` starts server
- [ ] `GET /api/health` returns `{ status: "ok" }`
- [ ] Missing required env vars produce clear error
- [ ] Config loads from `.env` with Zod validation

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
- [ ] DB file created at configured path on first start
- [ ] Both tables exist with correct columns and indexes
- [ ] `db` client singleton exportable for use in other modules
- [ ] Migration runs idempotently (safe to restart)

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
- [ ] Client initializes with API key/secret/passphrase from config
- [ ] `getFuturesPositions("USDT-FUTURES")` returns typed positions array
- [ ] `cancelFuturesOrder(symbol, orderId)` calls `futures_cancel_orders` endpoint
- [ ] `closeFuturesPosition(symbol, size)` places `futures_place_order` with `tradeSide: "close"`
- [ ] Paper-trading mode flag routes to demo base URL
- [ ] All write methods typed and callable

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
- [ ] `listPlaybooks()` returns typed array with `trading_symbols`, `official_metrics`
- [ ] When access key is missing, returns mock data matching `btc-ema-cross-demo` shape
- [ ] Zod validates API responses at boundary
- [ ] Mock mode clearly logged on startup

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
- [ ] `bun install && bun run check && bun run typecheck` passes
- [ ] Server starts, health endpoint responds
- [ ] DB tables exist
- [ ] Bitget client fetches live ticker
- [ ] Playbook client returns mock data

---

## Phase 2: Contract + Observer

### Task 7: Behavioral contract derivation

**Description:** Pure function that takes Playbook API response and produces a `BehavioralContract`. Maps each backtest field to a contract rule per FR-1 table in PRD.

**Acceptance criteria:**
- [ ] Given `trading_symbols: ["BTCUSDT"]` → `allowedSymbols: ["BTCUSDT"]`
- [ ] Given `max_drawdown_pct: 12.5` → `maxDrawdownPct: 12.5`
- [ ] Given `sharpe_ratio: 1.8` → `backTestSharpe: 1.8`
- [ ] All fields from spec's BehavioralContract populated
- [ ] Invalid/missing backtest fields produce sensible defaults with warnings

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
- [ ] `saveContract(playbookId, contract)` persists to DB
- [ ] `loadContract(playbookId)` returns deserialized BehavioralContract
- [ ] Re-saving updates `contract_derived_at`
- [ ] Returns null for unknown playbook ID

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
- [ ] Returns valid `LiveState` struct with all fields populated
- [ ] Computes `totalExposure` from open orders + positions
- [ ] Computes `currentDrawdown` from peak balance vs current
- [ ] Handles empty account (no orders, no positions) gracefully

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
- [ ] Loop starts on server boot
- [ ] Runs at `POLL_INTERVAL_MS` interval
- [ ] Each cycle calls poller → logs LiveState summary
- [ ] Graceful shutdown on process exit
- [ ] Skips cycle if previous is still running (no overlap)

**Verification:**
- Start server → see polling logs every 15s → stop → clean exit

**Dependencies:** Task 9

**Files:**
- `packages/server/src/observer/loop.ts`
- `packages/server/src/index.ts` (wire loop startup)

**Scope:** S

---

### Checkpoint: Contract + Observer
- [ ] Server starts → derives contract from mock data → observer polls every 15s
- [ ] Logs show LiveState snapshots with real Bitget data
- [ ] Contract stored in SQLite and loadable

---

## Phase 3: Drift Detection + Risk Scoring

### Task 11: Drift detection rules

**Description:** Implement individual drift detection functions — one per rule: asset drift, position oversize, drawdown breach, unauthorized trade, Sharpe degradation. Each returns a `DriftResult`.

**Acceptance criteria:**
- [ ] `detectAssetDrift(contract, state)` → violation when order on non-allowed symbol
- [ ] `detectOversize(contract, state)` → violation when exposure > margin budget
- [ ] `detectDrawdownBreach(contract, state)` → violation when drawdown > max
- [ ] `detectSharpeDegradation(contract, state)` → warn when rolling < backtest
- [ ] Each returns `pass` when within bounds

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
- [ ] Score = 0 when all rules pass (no drift)
- [ ] Score ≥ 70 when drawdown at 100% of max (critical)
- [ ] Score = 25 when one asset drifts but nothing else
- [ ] Risk state maps correctly: 0–39 healthy, 40–69 elevated, 70–100 critical

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
- [ ] Observer logs drift results per cycle
- [ ] Risk score computed and logged
- [ ] `playbooks` table updated with `risk_score` and `risk_state` each cycle
- [ ] No enforcement yet (still stub)

**Verification:**
- Start server → manually check DB shows updating risk scores

**Dependencies:** Task 10, Task 11, Task 12, Task 8

**Files:**
- `packages/server/src/observer/loop.ts` (replace detect stub)
- `packages/server/src/db/queries.ts` (update risk state)

**Scope:** S

---

### Checkpoint: Drift + Scoring
- [ ] Observer detects drift when state violates contract
- [ ] Risk score reflects severity correctly
- [ ] DB shows live risk state per playbook

---

## Phase 4: Enforcement

### Task 14: Enforcement decision logic

**Description:** Pure function: given `DriftResult[]` + `OperatingMode` → decide which enforcement actions to take. Returns action descriptors (what to cancel, what to close).

**Acceptance criteria:**
- [ ] Mode = enforce + violation → returns action
- [ ] Mode = observe + violation → returns `none`
- [ ] Mode = silent + violation → returns `none`
- [ ] Maps violation type to correct action (asset drift → cancel order, drawdown → close position)

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
- [ ] `cancelOrder(orderId, symbol)` calls `futures_cancel_orders` → returns success/fail
- [ ] `cancelPlanOrder(orderId, symbol)` cancels futures plan (trigger) order
- [ ] `closePosition(symbol, size)` places `futures_place_order` with `tradeSide: "close"` → closes position
- [ ] All actions return structured result (success + orderId, or failed + error)

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
- [ ] Enforcement fires only in `enforce` mode
- [ ] Correct action type per violation (cancel order for asset drift, close position for drawdown)
- [ ] Action result (success/fail) captured for trace
- [ ] Observer loop continues even if enforcement fails

**Verification:**
- Integration: set mode=enforce → place wrong-symbol order → order cancelled within 30s

**Dependencies:** Task 13, Task 14, Task 15

**Files:**
- `packages/server/src/observer/loop.ts` (replace enforce stub)

**Scope:** S

---

### Checkpoint: Enforcement
- [ ] In enforce mode: violating limit order cancelled automatically
- [ ] In observe mode: violation detected but no action taken
- [ ] Enforcement result captured (success/fail)

---

## Phase 5: Decision Trace + Alerts

### Task 17: Decision trace builder

**Description:** Function that assembles a complete `DecisionTrace` from cycle data — state snapshot, contract, drift results, risk score, enforcement action, and human-readable reasoning string.

**Acceptance criteria:**
- [ ] Produces valid DecisionTrace with all fields from spec
- [ ] Reasoning string is human-readable: "Detected ETHUSDT order — not in allowed set [BTCUSDT]. Risk score 25 (elevated). Action: cancelled order abc123."
- [ ] Handles pass case: "All 4 rules passed. Risk score 0 (healthy). No action."

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
- [ ] `saveTrace(trace)` persists to DB
- [ ] `listTraces({ playbookId, limit, offset, action })` returns filtered results
- [ ] `getTrace(id)` returns single trace with full detail
- [ ] JSON fields (live_state, drift_results) round-trip correctly

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
- [ ] Every cycle produces a trace in SQLite
- [ ] Trace includes enforcement result if action was taken
- [ ] Pass cycles also traced (full audit trail)

**Verification:**
- Start server → let run 3 cycles → query DB → 3 traces exist

**Dependencies:** Task 10, Task 17, Task 18

**Files:**
- `packages/server/src/observer/loop.ts` (replace trace stub)

**Scope:** S

---

### Task 20: Telegram bot + alert formatting

**Description:** Set up grammy bot. Format violation alerts with: playbook name, violation type, action taken, observed vs contract bound, severity. Send on violations in enforce/observe mode.

**Acceptance criteria:**
- [ ] Bot initializes with `TELEGRAM_BOT_TOKEN`
- [ ] `sendAlert(trace)` formats and sends message to `TELEGRAM_CHAT_ID`
- [ ] Message includes: playbook, violation, action, values, timestamp
- [ ] No alert sent in `silent` mode or when all rules pass
- [ ] Graceful no-op if Telegram env vars not configured

**Verification:**
- Integration: trigger violation → Telegram message received
- Telegram chat ID obtained via /start interaction with bot

**Dependencies:** Task 3, Task 17

**Files:**
- `packages/server/src/alerts/telegram.ts`
- `packages/server/src/alerts/types.ts`
- `packages/server/tests/alerts/telegram.test.ts`

**Scope:** S

---

### Task 21: Wire alerts into observer loop

**Description:** After trace is built, if mode ≠ silent and violations exist, fire Telegram alert.

**Acceptance criteria:**
- [ ] Alert fires on violation in enforce mode
- [ ] Alert fires on violation in observe mode
- [ ] No alert in silent mode
- [ ] No alert when all rules pass (even in enforce mode)

**Verification:**
- End-to-end: violation → trace in DB + Telegram alert

**Dependencies:** Task 19, Task 20

**Files:**
- `packages/server/src/observer/loop.ts` (replace alert stub)

**Scope:** XS

---

### Checkpoint: Trace + Alerts
- [ ] Every cycle persists a decision trace
- [ ] Traces queryable by playbook and action type
- [ ] Telegram alerts fire on violations (enforce + observe modes)
- [ ] Full observer cycle: poll → detect → score → enforce → trace → alert

---

## Phase 6: API Layer

### Task 22: Playbook API routes

**Description:** Hono routes: `GET /api/playbooks` (list), `GET /api/playbooks/:id` (detail with contract + risk), `PATCH /api/playbooks/:id/mode` (switch mode).

**Acceptance criteria:**
- [ ] List returns all playbooks with risk_score, risk_state, mode
- [ ] Detail includes full contract + last trace
- [ ] Mode switch validates input (must be enforce/observe/silent)
- [ ] Mode switch updates DB, effective next cycle

**Verification:**
- curl each endpoint → correct JSON responses

**Dependencies:** Task 4, Task 8

**Files:**
- `packages/server/src/api/playbooks.ts`
- `packages/server/src/api/modes.ts`
- `packages/server/src/api/routes.ts` (register)

**Scope:** S

---

### Task 23: Trace API routes

**Description:** Hono routes: `GET /api/traces` (paginated, filterable), `GET /api/traces/:id` (single trace detail).

**Acceptance criteria:**
- [ ] List supports `?playbook_id=`, `?action=`, `?limit=`, `?offset=`
- [ ] Detail returns full trace with deserialized JSON fields
- [ ] Empty result returns `[]`, not error

**Verification:**
- curl with various filters → correct results

**Dependencies:** Task 18

**Files:**
- `packages/server/src/api/traces.ts`
- `packages/server/src/api/routes.ts` (register)

**Scope:** S

---

### Task 24: SSE event stream

**Description:** `GET /api/events` SSE endpoint. Emits events on: new trace, risk state change, enforcement action.

**Acceptance criteria:**
- [ ] Client connects → receives heartbeat every 30s
- [ ] New trace → `event: trace` with trace summary payload
- [ ] Risk state change → `event: risk_state_change` with playbook + new state
- [ ] Multiple clients can connect simultaneously

**Verification:**
- Connect via `curl -N /api/events` → see events flow as observer runs

**Dependencies:** Task 19

**Files:**
- `packages/server/src/api/events.ts`
- `packages/server/src/api/routes.ts` (register)

**Scope:** M

---

### Checkpoint: API
- [ ] All REST endpoints respond correctly with valid `Authorization` header
- [ ] All REST endpoints reject requests without auth (401)
- [ ] SSE streams live trace events
- [ ] Mode switching works via API

---

## Phase 7: Integration Surface

### Task 25: API authentication middleware

**Description:** Hono middleware that validates `Authorization: Bearer *** on all `/api/*` routes. Token sourced from `ZENITHPULSE_API_KEY` env var.

**Acceptance criteria:**
- [ ] Valid token → request proceeds
- [ ] Missing or wrong token → 401 `{ error: "unauthorized" }`
- [ ] Health endpoint (`/api/health`) exempt from auth
- [ ] `/skill.md` route exempt from auth
- [ ] Token comparison is constant-time (no timing attacks)

**Verification:**
- `curl /api/playbooks` without header → 401
- `curl /api/playbooks -H "Authorization: Bearer *** → 200
- `curl /skill.md` (no header) → 200

**Dependencies:** Task 22

**Files:**
- `packages/server/src/middleware/auth.ts`
- `packages/server/src/api/routes.ts` (apply middleware)

**Scope:** S

---

### Task 26: SKILL.md — agent integration guide

**Description:** Author a `packages/server/src/static/skill.md` file and serve it as a static Hono route on `GET /skill.md` with no authentication required. This is the machine-readable integration guide agents use to self-configure without reading external docs.

**Content must include:**
- Product description (one paragraph, plain text)
- MCP config JSON block (copy-paste ready)
- All 5 MCP tools: name, description, input params, one example call
- REST API quick-start: register playbook, get risk score, list traces — curl examples with auth header
- CLI quick-start: `bunx zenithpulse start`, `bunx zenithpulse status`
- Required environment variables table
- One integration narrative: "Pass this URL to your coding agent and it will configure ZenithPulse automatically."

**Acceptance criteria:**
- [ ] `packages/server/src/static/skill.md` exists and is valid Markdown
- [ ] Hono route `GET /skill.md` serves the file with `Content-Type: text/markdown`
- [ ] No authentication required — returns 200 without `Authorization` header
- [ ] File is < 3000 characters (fast to ingest by any agent)
- [ ] MCP config block is valid JSON
- [ ] All curl examples use placeholder `$ZENITHPULSE_API_KEY` (not hardcoded)

**Verification:**
- `curl http://localhost:3001/skill.md` → 200, `Content-Type: text/markdown`, valid Markdown
- Load URL in Claude Code MCP client → agent can configure ZenithPulse from the guide alone

**Dependencies:** Task 22

**Files:**
- `packages/server/src/static/skill.md`
- `packages/server/src/api/routes.ts` (register `/skill.md` route)

**Scope:** S

---

### Task 27: MCP server

**Description:** Implement a Model Context Protocol server in `packages/server/src/mcp/` using `@modelcontextprotocol/sdk`. Expose 5 tools that proxy to the internal runtime state. MCP server starts on stdio when `--mcp` flag is passed to CLI.

**Acceptance criteria:**
- [ ] `get_risk_score(playbookId)` → returns `{ score, riskState, timestamp }`
- [ ] `get_contract(playbookId)` → returns `BehavioralContract`
- [ ] `list_traces({ playbookId, limit })` → returns `DecisionTrace[]`
- [ ] `set_mode(playbookId, mode)` → updates mode, returns new mode
- [ ] `get_health()` → returns `{ status, activePLaybooks, uptimeMs }`
- [ ] All tools validate input with Zod
- [ ] All tools return descriptive error if runtime not started

**Verification:**
- Unit test: each tool handler with mocked DB → correct output shape
- Integration: start with `--mcp` → call `get_health` via MCP client → response received

**Dependencies:** Task 22, Task 23

**Files:**
- `packages/server/src/mcp/server.ts`
- `packages/server/src/mcp/tools.ts`
- `packages/server/tests/mcp/tools.test.ts`

**Scope:** M

---

### Task 28: CLI package

**Description:** `@zenithpulse/cli` package using `citty`. Two commands: `start` (spawns server + dashboard, accepts `--mcp` flag to also start MCP server on stdio) and `status` (hits `/api/health` and prints formatted output). Published with a `bin` entry so `bunx zenithpulse` works.

**Acceptance criteria:**
- [ ] `bunx zenithpulse start` → server on :3001 + dashboard on :3000
- [ ] `bunx zenithpulse start --mcp` → server + dashboard + MCP server on stdio
- [ ] `bunx zenithpulse status` → prints runtime health (or "not running" if server unreachable)
- [ ] `package.json` has `bin: { zenithpulse: "./src/bin.ts" }`
- [ ] No crash if `ZENITHPULSE_API_KEY` not set (print warning, still start)

**Verification:**
- `bunx zenithpulse start` → curl :3001/api/health → ok
- `bunx zenithpulse status` → formatted health output

**Dependencies:** Task 3, Task 27

**Files:**
- `packages/cli/package.json`
- `packages/cli/tsconfig.json`
- `packages/cli/src/bin.ts`
- `packages/cli/src/index.ts`
- `packages/cli/src/commands/start.ts`
- `packages/cli/src/commands/status.ts`

**Scope:** M

---

### Checkpoint: Integration Surface
- [ ] REST API rejects unauthenticated requests
- [ ] MCP server starts and all 5 tools respond correctly
- [ ] `bunx zenithpulse start` boots the full runtime
- [ ] `bunx zenithpulse status` returns health
- [ ] `GET /skill.md` returns 200 with agent-readable Markdown (no auth)

---

## Phase 8: Dashboard

### Task 29: Dashboard scaffold

**Description:** Next.js 16 app with App Router, Tailwind v4, shadcn/ui. Layout with nav. Dev server runs on port 3000.

**Acceptance criteria:**
- [ ] `bun run --filter @zenithpulse/dashboard dev` starts on :3000
- [ ] Layout renders with navigation (Portfolio, Traces)
- [ ] Tailwind + shadcn components work
- [ ] API proxy or CORS configured to hit server on :3001

**Verification:**
- Open http://localhost:3000 → renders shell

**Dependencies:** Task 1

**Files:**
- `packages/dashboard/src/app/layout.tsx`
- `packages/dashboard/src/app/page.tsx`
- `packages/dashboard/next.config.ts`
- `packages/dashboard/tailwind.config.ts`

**Scope:** M

---

### Task 30: API client + SSE hook

**Description:** Fetch wrapper for server API and React hook for SSE connection that updates state on events.

**Acceptance criteria:**
- [ ] `api.getPlaybooks()` fetches and returns typed data
- [ ] `api.getTraces(filters)` fetches with query params
- [ ] `useSSE()` hook connects to /api/events, returns latest event
- [ ] Auto-reconnect on SSE disconnect

**Verification:**
- Dashboard fetches real data from running server

**Dependencies:** Task 22, Task 24, Task 29

**Files:**
- `packages/dashboard/src/lib/api.ts`
- `packages/dashboard/src/lib/sse.ts`
- `packages/dashboard/src/hooks/use-playbooks.ts`

**Scope:** S

---

### Task 31: Portfolio page (all Playbooks overview)

**Description:** Home page showing all monitored Playbooks with risk score, risk state, mode, and last action. Real-time updates via SSE.

**Acceptance criteria:**
- [ ] Lists all playbooks with: name, risk score gauge, risk state badge, mode
- [ ] Updates without refresh when SSE event arrives
- [ ] Click playbook → navigates to detail page
- [ ] Empty state when no playbooks configured

**Verification:**
- Open dashboard → see playbook with live risk score updating

**Dependencies:** Task 30

**Files:**
- `packages/dashboard/src/app/page.tsx`
- `packages/dashboard/src/components/risk-score.tsx`
- `packages/dashboard/src/components/alert-badge.tsx`

**Scope:** M

---

### Task 32: Playbook detail page

**Description:** Per-Playbook page showing: derived behavioral contract, current drift state, risk score, mode switcher, recent enforcement actions.

**Acceptance criteria:**
- [ ] Shows contract rules (allowed symbols, drawdown cap, etc.)
- [ ] Shows current risk score + state
- [ ] Mode switcher toggles mode via API (with confirmation for enforce)
- [ ] Recent actions list from traces

**Verification:**
- Navigate to playbook → see contract + mode switcher → switch mode → confirmed

**Dependencies:** Task 30

**Files:**
- `packages/dashboard/src/app/playbooks/[id]/page.tsx`
- `packages/dashboard/src/components/contract-view.tsx`
- `packages/dashboard/src/components/mode-switcher.tsx`

**Scope:** M

---

### Task 33: Decision trace feed page

**Description:** Chronological log of all observations with filtering. Shows reasoning, action taken, severity.

**Acceptance criteria:**
- [ ] Lists traces newest-first with: timestamp, playbook, result, action, reasoning
- [ ] Filterable by playbook and action type
- [ ] Expandable row shows full trace detail
- [ ] Paginated (load more on scroll)

**Verification:**
- Open traces page → see trace log updating as observer runs

**Dependencies:** Task 30

**Files:**
- `packages/dashboard/src/app/traces/page.tsx`
- `packages/dashboard/src/components/trace-feed.tsx`

**Scope:** M

---

### Checkpoint: Dashboard
- [ ] Portfolio page shows live risk scores
- [ ] Playbook detail shows contract + mode switcher works
- [ ] Trace feed shows decision history
- [ ] All updates reflect within 15s via SSE
- [ ] Demo scenario executable end-to-end

---

## Phase 9: Ship

### Task 34: End-to-end demo flow

**Description:** Wire everything for the 3-minute demo scenario. Verify: start → derive contract → green state → trigger violation (bgc command) → enforcement fires → trace logged → alert sent → dashboard shows it.

**Acceptance criteria:**
- [ ] Demo scenario from PRD executable in paper-trading mode
- [ ] All 5 demo steps work without manual intervention (except the trigger)
- [ ] Latency within spec: detection ≤15s, enforcement ≤30s, alert ≤30s

**Verification:**
- Run through full demo scenario, time each step

**Dependencies:** All previous tasks

**Files:**
- Minor tweaks across observer loop, config, dashboard

**Scope:** S

---

### Task 35: README + packaging

**Description:** Write README with: what it is, integration surface (REST API, MCP, CLI, SKILL.md), quick start, env setup, demo instructions. Package.json metadata for `npm publish`.

**Acceptance criteria:**
- [ ] README opens with what ZenithPulse is (2 sentences)
- [ ] Integration section: REST API example, MCP config snippet, CLI commands
- [ ] Quick start: `bunx zenithpulse start` → working runtime in < 5 mins
- [ ] Demo section matches PRD demo scenario
- [ ] `package.json` root has `name`, `description`, `repository`, `keywords`

**Verification:**
- Fresh clone → follow README → system runs

**Dependencies:** Task 34

**Files:**
- `README.md`
- `package.json` (metadata only)

**Scope:** S

---

### Checkpoint: Ship-ready
- [ ] Demo scenario works end-to-end
- [ ] `bunx zenithpulse start` boots the full runtime
- [ ] MCP tools callable from a real MCP client
- [ ] README is complete and accurate
- [ ] `bun run check && bun run test && bun run typecheck` all pass
- [ ] No secrets in committed files
- [ ] Ready for 3-minute video recording
