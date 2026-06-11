1|# Implementation Tasks: ZenithPulse
2|
3|## Overview
4|
5|Vertical-slice task breakdown following the implementation plan. Each task leaves the system in a working state. Tasks are sized S–M (1–5 files each).
6|
7|---
8|
9|## Phase 1: Foundation
10|
11|### Task 1: Monorepo scaffold + tooling
12|
13|**Description:** Set up Bun workspace root with three packages (server, dashboard, shared). Configure biome, tsconfig, and root scripts.
14|
15|**Acceptance criteria:**
16|- [x] `bun install` succeeds with no errors
17|- [x] `bun run check` (biome) passes
18|- [x] `bun run typecheck` passes
19|- [x] Three workspace packages resolve each other
20|
21|**Verification:**
22|- `bun install && bun run check && bun run typecheck`
23|
24|**Dependencies:** None
25|
26|**Files:**
27|- `package.json` (root)
28|- `biome.json`
29|- `tsconfig.json`
30|- `packages/server/package.json`
31|- `packages/server/tsconfig.json`
32|- `packages/dashboard/package.json`
33|- `packages/dashboard/tsconfig.json`
34|- `packages/shared/package.json`
35|- `packages/shared/tsconfig.json`
36|- `.env.example`
37|- `.gitignore`
38|
39|**Scope:** M
40|
41|---
42|
43|### Task 2: Shared types package
44|
45|**Description:** Define all shared types in `@zenithpulse/shared` — BehavioralContract, LiveState, DriftResult, DecisionTrace, OperatingMode, RiskState, constants.
46|
47|**Acceptance criteria:**
48|- [x] All types from spec's "Key Types" section exist
49|- [x] Constants for modes and risk thresholds exported
50|- [x] Package importable from server and dashboard
51|- [x] `bun run typecheck` passes
52|
53|**Verification:**
54|- `bun run typecheck`
55|
56|**Dependencies:** Task 1
57|
58|**Files:**
59|- `packages/shared/src/types.ts`
60|- `packages/shared/src/constants.ts`
61|- `packages/shared/src/index.ts`
62|
63|**Scope:** S
64|
65|---
66|
67|### Task 3: Server scaffold (Hono hello world + config)
68|
69|**Description:** Set up Hono server with env config (Zod-validated), health endpoint, and dev script. Server starts on port 3001.
70|
71|**Acceptance criteria:**
72|- [x] `bun run --filter @zenithpulse/server dev` starts server
73|- [x] `GET /api/health` returns `{ status: "ok" }`
74|- [x] Missing required env vars produce clear error
75|- [x] Config loads from `.env` with Zod validation
76|
77|**Verification:**
78|- Start server → `curl http://localhost:3001/api/health`
79|
80|**Dependencies:** Task 1
81|
82|**Files:**
83|- `packages/server/src/index.ts`
84|- `packages/server/src/config.ts`
85|- `packages/server/src/api/routes.ts`
86|
87|**Scope:** S
88|
89|---
90|
91|### Task 4: SQLite + Drizzle schema and connection
92|
93|**Description:** Set up Drizzle ORM with `bun:sqlite` driver. Define `playbooks` and `traces` tables from spec. Auto-migrate on startup.
94|
95|**Acceptance criteria:**
96|- [x] DB file created at configured path on first start
97|- [x] Both tables exist with correct columns and indexes
98|- [x] `db` client singleton exportable for use in other modules
99|- [x] Migration runs idempotently (safe to restart)
100|
101|**Verification:**
102|- Start server → check `data/zenithpulse.db` exists → query `sqlite3 data/zenithpulse.db ".tables"`
103|
104|**Dependencies:** Task 3
105|
106|**Files:**
107|- `packages/server/src/db/schema.ts`
108|- `packages/server/src/db/client.ts`
109|- `packages/server/src/db/migrate.ts`
110|
111|**Scope:** S
112|
113|---
114|
115|### Task 5: Bitget API client wrapper
116|
117|**Description:** Import `bitget-core` from `.resources/agent_hub` and wrap it in a typed client. Exposes read methods (futures positions, open orders, plan orders, account balance) and write methods (cancel futures order, cancel plan order, close position via tradeSide:close). All calls target USDT-margined perpetual futures (`productType: USDT-FUTURES`).
118|
119|**Acceptance criteria:**
120|- [x] Client initializes with API key/secret/passphrase from config
121|- [x] `getFuturesPositions("USDT-FUTURES")` returns typed positions array
122|- [x] `cancelFuturesOrder(symbol, orderId)` calls `futures_cancel_orders` endpoint
123|- [x] `closeFuturesPosition(symbol, size)` places `futures_place_order` with `tradeSide: "close"`
124|- [x] Paper-trading mode flag routes to demo base URL
125|- [x] All write methods typed and callable
126|
127|**Verification:**
128|- Unit test: mock responses → typed outputs
129|- Integration (manual, paper mode): `getFuturesPositions` returns positions array
130|
131|**Dependencies:** Task 3
132|
133|**Files:**
134|- `packages/server/src/bitget/client.ts`
135|- `packages/server/tests/bitget/client.test.ts`
136|
137|**Scope:** S
138|
139|---
140|
141|### Task 6: Playbook API client (getagent-skill)
142|
143|**Description:** HTTP client for `getagent-skill` API. Implements `listPlaybooks()` and `getPlaybookRun(runId)`. Returns typed backtest metrics. Includes mock fallback when `PLAYBOOK_ACCESS_KEY` is not set.
144|
145|**Acceptance criteria:**
146|- [x] `listPlaybooks()` returns typed array with `trading_symbols`, `official_metrics`
147|- [x] When access key is missing, returns mock data matching `btc-ema-cross-demo` shape
148|- [x] Zod validates API responses at boundary
149|- [x] Mock mode clearly logged on startup
150|
151|**Verification:**
152|- Unit test: mock API response → valid typed output
153|- Unit test: missing key → mock data returned
154|
155|**Dependencies:** Task 3
156|
157|**Files:**
158|- `packages/server/src/bitget/playbook-api.ts`
159|- `packages/server/tests/contract/playbook-api.test.ts`
160|
161|**Scope:** S
162|
163|---
164|
165|### Checkpoint: Foundation
166|- [x] `bun install && bun run check && bun run typecheck` passes
167|- [x] Server starts, health endpoint responds
168|- [x] DB tables exist
169|- [x] Bitget client fetches live ticker
170|- [x] Playbook client returns mock data
171|
172|---
173|
174|## Phase 2: Contract + Observer
175|
176|### Task 7: Behavioral contract derivation
177|
178|**Description:** Pure function that takes Playbook API response and produces a `BehavioralContract`. Maps each backtest field to a contract rule per FR-1 table in PRD.
179|
180|**Acceptance criteria:**
181|- [x] Given `trading_symbols: ["BTCUSDT"]` → `allowedSymbols: ["BTCUSDT"]`
182|- [x] Given `max_drawdown_pct: 12.5` → `maxDrawdownPct: 12.5`
183|- [x] Given `sharpe_ratio: 1.8` → `backTestSharpe: 1.8`
184|- [x] All fields from spec's BehavioralContract populated
185|- [x] Invalid/missing backtest fields produce sensible defaults with warnings
186|
187|**Verification:**
188|- `bun run --filter @zenithpulse/server test` — contract derivation tests pass
189|
190|**Dependencies:** Task 2, Task 6
191|
192|**Files:**
193|- `packages/server/src/contract/derive.ts`
194|- `packages/server/src/contract/schema.ts`
195|- `packages/server/tests/contract/derive.test.ts`
196|
197|**Scope:** S
198|
199|---
200|
201|### Task 8: Contract persistence (store + load)
202|
203|**Description:** Functions to save derived contract to SQLite `playbooks` table and load it. Upsert on re-derivation.
204|
205|**Acceptance criteria:**
206|- [x] `saveContract(playbookId, contract)` persists to DB
207|- [x] `loadContract(playbookId)` returns deserialized BehavioralContract
208|- [x] Re-saving updates `contract_derived_at`
209|- [x] Returns null for unknown playbook ID
210|
211|**Verification:**
212|- Integration test: save → load → matches original
213|
214|**Dependencies:** Task 4, Task 7
215|
216|**Files:**
217|- `packages/server/src/contract/store.ts`
218|- `packages/server/tests/contract/store.test.ts`
219|
220|**Scope:** S
221|
222|---
223|
224|### Task 9: Live state poller
225|
226|**Description:** Function that calls Bitget API and assembles a `LiveState` snapshot — account balance, open orders, plan orders, ticker prices, computed drawdown and exposure.
227|
228|**Acceptance criteria:**
229|- [x] Returns valid `LiveState` struct with all fields populated
230|- [x] Computes `totalExposure` from open orders + positions
231|- [x] Computes `currentDrawdown` from peak balance vs current
232|- [x] Handles empty account (no orders, no positions) gracefully
233|
234|**Verification:**
235|- Unit test: mocked API responses → correct LiveState assembly
236|- Integration (manual): returns real data from Bitget
237|
238|**Dependencies:** Task 2, Task 5
239|
240|**Files:**
241|- `packages/server/src/observer/poller.ts`
242|- `packages/server/src/observer/state.ts`
243|- `packages/server/tests/observer/poller.test.ts`
244|
245|**Scope:** M
246|
247|---
248|
249|### Task 10: Observer loop orchestrator
250|
251|**Description:** Timer-based loop that runs at configured interval (default 15s). Each cycle: poll → detect → score → enforce → trace → alert. This task wires the skeleton — detect/score/enforce/trace/alert are stubs that log and return defaults.
252|
253|**Acceptance criteria:**
254|- [x] Loop starts on server boot
255|- [x] Runs at `POLL_INTERVAL_MS` interval
256|- [x] Each cycle calls poller → logs LiveState summary
257|- [x] Graceful shutdown on process exit
258|- [x] Skips cycle if previous is still running (no overlap)
259|
260|**Verification:**
261|- Start server → see polling logs every 15s → stop → clean exit
262|
263|**Dependencies:** Task 9
264|
265|**Files:**
266|- `packages/server/src/observer/loop.ts`
267|- `packages/server/src/index.ts` (wire loop startup)
268|
269|**Scope:** S
270|
271|---
272|
273|### Checkpoint: Contract + Observer
274|- [x] Server starts → derives contract from mock data → observer polls every 15s
275|- [x] Logs show LiveState snapshots with real Bitget data
276|- [x] Contract stored in SQLite and loadable
277|
278|---
279|
280|## Phase 3: Drift Detection + Risk Scoring
281|
282|### Task 11: Drift detection rules
283|
284|**Description:** Implement individual drift detection functions — one per rule: asset drift, position oversize, drawdown breach, unauthorized trade, Sharpe degradation. Each returns a `DriftResult`.
285|
286|**Acceptance criteria:**
287|- [ ] `detectAssetDrift(contract, state)` → violation when order on non-allowed symbol
288|- [ ] `detectOversize(contract, state)` → violation when exposure > margin budget
289|- [ ] `detectDrawdownBreach(contract, state)` → violation when drawdown > max
290|- [ ] `detectSharpeDegradation(contract, state)` → warn when rolling < backtest
291|- [ ] Each returns `pass` when within bounds
292|
293|**Verification:**
294|- `bun run --filter @zenithpulse/server test` — all drift rule tests pass
295|
296|**Dependencies:** Task 2
297|
298|**Files:**
299|- `packages/server/src/drift/detect.ts`
300|- `packages/server/src/drift/types.ts`
301|- `packages/server/tests/drift/detect.test.ts`
302|
303|**Scope:** M
304|
305|---
306|
307|### Task 12: Risk score computation
308|
309|**Description:** Implement the `computeRiskScore` function from the spec. Takes contract + state, returns 0–100 score using max-of-weighted-factors formula.
310|
311|**Acceptance criteria:**
312|- [ ] Score = 0 when all rules pass (no drift)
313|- [ ] Score ≥ 70 when drawdown at 100% of max (critical)
314|- [ ] Score = 25 when one asset drifts but nothing else
315|- [ ] Risk state maps correctly: 0–39 healthy, 40–69 elevated, 70–100 critical
316|
317|**Verification:**
318|- Unit tests with known inputs → expected scores
319|
320|**Dependencies:** Task 11
321|
322|**Files:**
323|- `packages/server/src/drift/score.ts`
324|- `packages/server/tests/drift/score.test.ts`
325|
326|**Scope:** S
327|
328|---
329|
330|### Task 13: Wire drift + scoring into observer loop
331|
332|**Description:** Replace stub in observer loop with real drift detection and risk scoring. Each cycle now evaluates all rules and computes risk score. Update playbook risk state in DB.
333|
334|**Acceptance criteria:**
335|- [ ] Observer logs drift results per cycle
336|- [ ] Risk score computed and logged
337|- [ ] `playbooks` table updated with `risk_score` and `risk_state` each cycle
338|- [ ] No enforcement yet (still stub)
339|
340|**Verification:**
341|- Start server → manually check DB shows updating risk scores
342|
343|**Dependencies:** Task 10, Task 11, Task 12, Task 8
344|
345|**Files:**
346|- `packages/server/src/observer/loop.ts` (replace detect stub)
347|- `packages/server/src/db/queries.ts` (update risk state)
348|
349|**Scope:** S
350|
351|---
352|
353|### Checkpoint: Drift + Scoring
354|- [ ] Observer detects drift when state violates contract
355|- [ ] Risk score reflects severity correctly
356|- [ ] DB shows live risk state per playbook
357|
358|---
359|
360|## Phase 4: Enforcement
361|
362|### Task 14: Enforcement decision logic
363|
364|**Description:** Pure function: given `DriftResult[]` + `OperatingMode` → decide which enforcement actions to take. Returns action descriptors (what to cancel, what to close).
365|
366|**Acceptance criteria:**
367|- [ ] Mode = enforce + violation → returns action
368|- [ ] Mode = observe + violation → returns `none`
369|- [ ] Mode = silent + violation → returns `none`
370|- [ ] Maps violation type to correct action (asset drift → cancel order, drawdown → close position)
371|
372|**Verification:**
373|- Unit tests covering all mode × violation combinations
374|
375|**Dependencies:** Task 2, Task 11
376|
377|**Files:**
378|- `packages/server/src/enforce/engine.ts`
379|- `packages/server/src/enforce/types.ts`
380|- `packages/server/tests/enforce/engine.test.ts`
381|
382|**Scope:** S
383|
384|---
385|
386|### Task 15: Enforcement actions (cancel + close position)
387|
388|**Description:** Functions that execute enforcement via Bitget futures mix API — cancel order by ID (`futures_cancel_orders`), cancel plan order (futures plan), close position via market order (`futures_place_order` with `tradeSide: "close"`).
389|
390|**Acceptance criteria:**
391|- [ ] `cancelOrder(orderId, symbol)` calls `futures_cancel_orders` → returns success/fail
392|- [ ] `cancelPlanOrder(orderId, symbol)` cancels futures plan (trigger) order
393|- [ ] `closePosition(symbol, size)` places `futures_place_order` with `tradeSide: "close"` → closes position
394|- [ ] All actions return structured result (success + orderId, or failed + error)
395|
396|**Verification:**
397|- Unit test: mocked API → correct request params sent
398|- Integration (manual, demo mode): place limit order → cancel it
399|
400|**Dependencies:** Task 5
401|
402|**Files:**
403|- `packages/server/src/enforce/actions.ts`
404|- `packages/server/tests/enforce/actions.test.ts`
405|
406|**Scope:** S
407|
408|---
409|
410|### Task 16: Wire enforcement into observer loop
411|
412|**Description:** Replace enforcement stub in observer loop. After drift detection, if mode=enforce and violations exist, execute enforcement actions.
413|
414|**Acceptance criteria:**
415|- [ ] Enforcement fires only in `enforce` mode
416|- [ ] Correct action type per violation (cancel order for asset drift, close position for drawdown)
417|- [ ] Action result (success/fail) captured for trace
418|- [ ] Observer loop continues even if enforcement fails
419|
420|**Verification:**
421|- Integration: set mode=enforce → place wrong-symbol order → order cancelled within 30s
422|
423|**Dependencies:** Task 13, Task 14, Task 15
424|
425|**Files:**
426|- `packages/server/src/observer/loop.ts` (replace enforce stub)
427|
428|**Scope:** S
429|
430|---
431|
432|### Checkpoint: Enforcement
433|- [ ] In enforce mode: violating limit order cancelled automatically
434|- [ ] In observe mode: violation detected but no action taken
435|- [ ] Enforcement result captured (success/fail)
436|
437|---
438|
439|## Phase 5: Decision Trace + Alerts
440|
441|### Task 17: Decision trace builder
442|
443|**Description:** Function that assembles a complete `DecisionTrace` from cycle data — state snapshot, contract, drift results, risk score, enforcement action, and human-readable reasoning string.
444|
445|**Acceptance criteria:**
446|- [ ] Produces valid DecisionTrace with all fields from spec
447|- [ ] Reasoning string is human-readable: "Detected ETHUSDT order — not in allowed set [BTCUSDT]. Risk score 25 (elevated). Action: cancelled order abc123."
448|- [ ] Handles pass case: "All 4 rules passed. Risk score 0 (healthy). No action."
449|
450|**Verification:**
451|- Unit tests: various scenarios → correct trace assembly + reasoning
452|
453|**Dependencies:** Task 2
454|
455|**Files:**
456|- `packages/server/src/trace/record.ts`
457|- `packages/server/src/trace/types.ts`
458|- `packages/server/tests/trace/record.test.ts`
459|
460|**Scope:** S
461|
462|---
463|
464|### Task 18: Trace persistence
465|
466|**Description:** Write decision trace to SQLite `traces` table after each cycle. Query functions for listing traces (paginated, filterable).
467|
468|**Acceptance criteria:**
469|- [ ] `saveTrace(trace)` persists to DB
470|- [ ] `listTraces({ playbookId, limit, offset, action })` returns filtered results
471|- [ ] `getTrace(id)` returns single trace with full detail
472|- [ ] JSON fields (live_state, drift_results) round-trip correctly
473|
474|**Verification:**
475|- Integration test: save → list → get → data matches
476|
477|**Dependencies:** Task 4, Task 17
478|
479|**Files:**
480|- `packages/server/src/trace/store.ts`
481|- `packages/server/tests/trace/store.test.ts`
482|
483|**Scope:** S
484|
485|---
486|
487|### Task 19: Wire trace into observer loop
488|
489|**Description:** After drift + enforcement in each cycle, build trace and persist it. Emit the trace for SSE and alerts.
490|
491|**Acceptance criteria:**
492|- [ ] Every cycle produces a trace in SQLite
493|- [ ] Trace includes enforcement result if action was taken
494|- [ ] Pass cycles also traced (full audit trail)
495|
496|**Verification:**
497|- Start server → let run 3 cycles → query DB → 3 traces exist
498|
499|**Dependencies:** Task 10, Task 17, Task 18
500|
501|