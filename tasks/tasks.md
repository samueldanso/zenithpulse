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


