# PRD — ZenithPulse

## Product Overview

ZenithPulse is an autonomous runtime that derives behavioral contracts from Bitget Playbook backtest output, continuously monitors live execution for drift, scores risk per-Playbook in real time, reactively enforces when violations occur, and maintains a structured decision trace for every observation.

**Category:** Risk infrastructure for autonomous trading agents

**Track:** Bitget Hackathon Track 2 — Trading Infrastructure
**Target ship date:** June 25, 2026 (submission deadline)

---

## Problem Statement

Bitget's agent stack provides full lifecycle tooling — authoring (`getagent-skill`), backtesting, deployment, execution (`bgc`), and notifications (GetClaw). But once a Playbook goes live, nothing watches it. A strategy can:

- Drift from its backtest envelope with no detection
- Trade assets outside its designed universe with no scoring
- Breach drawdown limits with no enforcement
- Degrade in performance with no audit trail

Developers have no visibility during execution and no automated defense against drift. The gap between "Playbook deployed" and "capital lost" is completely empty.

**The gap:** Nothing derives rules from the backtest, nothing monitors live execution against those rules, nothing acts when drift occurs.

---

## Solution

ZenithPulse fills this gap with six components:

1. **Backtest-as-policy** — reads backtest metadata from `getagent-skill` API and derives a behavioral contract automatically. Zero configuration.
2. **Drift engine** — polls live execution state via `bitget-core` every 10–15 seconds. Detects deviation from the behavioral contract.
3. **Risk scoring** — composite per-Playbook risk score, updated in real time. Portfolio-level aggregate.
4. **Reactive enforcement** — in `enforce` mode, acts on violations:
   - Open limit orders outside contract → cancelled
   - Plan/trigger orders violating rules → cancelled before trigger
   - Filled positions breaching drawdown → liquidated via market sell
5. **Decision trace** — structured forensic record per observation. What was seen, which rule applied, what happened.
6. **Alerts** — Telegram notification within seconds of any violation or enforcement action.

**Key differentiator:** "Backtest-as-policy" — the Playbook's own backtest output IS the behavioral contract. Deploy a Playbook, connect ZenithPulse, monitoring + enforcement live in under 5 minutes. No config files, no threshold tuning. This is a Bitget-native concept that doesn't exist anywhere else.

**What separates this from a monitoring dashboard:**
- It has a **behavioral contract** derived from backtest — not arbitrary thresholds
- It **acts** — cancels orders, liquidates positions (in enforce mode)
- Every observation has a **structured decision trace** — auditable, explainable
- **Risk scoring** is continuous and composite, not binary pass/fail
- Three modes give the developer control: enforce / observe / silent

---

## Target User

**Primary:** Solo developers and small teams deploying Playbooks to Bitget GetAgent Cloud.

**Profile:**
- Already using `getagent-skill` to author and deploy strategies
- Running 1–5 Playbooks simultaneously
- No dedicated risk/ops team — they are their own risk team
- Want protection without building custom infrastructure per strategy

**User goal:** "I want to see when my Playbooks drift from their backtest envelope, understand why, and have the option for the system to stop them automatically before I lose more money."

---

## User Stories

### US-1: Zero-config contract derivation
> As a developer deploying a Playbook, I want ZenithPulse to derive a behavioral contract from my backtest output automatically so that I don't have to configure rules for every strategy.

**Acceptance:** Provide a Playbook API key → ZenithPulse fetches backtest metrics → behavioral contract appears in the dashboard within 60 seconds. No YAML, no JSON, no config.

### US-2: Drift detection and risk visibility
> As a developer with a live Playbook, I want to see when execution drifts from my backtest envelope — which rules are violated, how severe, and what happened — so that I can understand risk in real time.

**Acceptance:** Dashboard shows per-Playbook risk score, active drift violations, and decision trace for each observation cycle. Updates within 15 seconds of state change.

### US-3: Autonomous order enforcement
> As a developer in `enforce` mode, I want ZenithPulse to cancel orders that violate my Playbook's behavioral contract so that unauthorized trades never fill.

**Acceptance:** When a limit order is placed outside the allowed symbol set or exceeds sizing limits from the contract, ZenithPulse cancels it within 30 seconds. Cancellation logged with decision trace.

### US-4: Position breach liquidation
> As a developer whose Playbook has breached its drawdown contract, I want ZenithPulse to liquidate the breaching position so that losses are capped.

**Acceptance:** When live drawdown exceeds the backtest `max_drawdown_pct` threshold from the behavioral contract, ZenithPulse places a market sell to exit. Action logged, Telegram alert fired.

### US-5: Instant alerts
> As a developer away from my dashboard, I want Telegram alerts the moment drift is detected or enforcement fires so that I know my system is watching and protecting my capital.

**Acceptance:** Telegram message within 30 seconds of detection. Message includes: Playbook name, violation type, action taken (if enforce mode), observed value vs contract bound.

### US-6: Full decision trace
> As a developer reviewing runtime history, I want to see every decision ZenithPulse made — what it observed, which contract rule applied, what action it took.

**Acceptance:** Every observation stored with: timestamp, live state snapshot, applicable contract rule, result (pass/warn/violation), action taken (none/cancel/liquidate), reasoning string.

### US-7: Mode control
> As a developer, I want to choose how aggressively ZenithPulse acts — full enforcement, observe-only, or silent logging — so that I can tune it for my risk tolerance.

**Acceptance:** Three modes available: `enforce` (detect + act), `observe` (detect + alert only), `silent` (log only). Switchable at runtime without restart.

---

## Functional Requirements

### FR-1: Behavioral Contract Derivation (Backtest-as-Policy)

| Input (from getagent-skill API) | Derived contract rule |
|---|---|
| `trading_symbols` | Allowed asset set — any order/position outside this set is drift |
| `max_drawdown_pct` | Drawdown ceiling — breach triggers enforcement or alert |
| `sharpe_ratio` | Performance floor — degradation below threshold raises risk score |
| `margin_budget` (manifest) | Position size cap — exposure exceeding this is a violation |
| `execution_mode` | If `signal_only`, any direct trade is a violation |
| `total_return_pct` + `total_trades` | Expected return profile — significant underperformance raises risk score |

Contract re-derives on startup and on configurable interval (default: every 5 minutes).

### FR-2: Observer Loop

- Poll live data from Bitget API via `bitget-core`:
  - Account balances (spot)
  - Open orders (unfilled)
  - Order history / fills
  - Ticker prices (for mark-to-market and PnL calculation)
  - Plan/trigger orders (pending)
- Polling interval: configurable, default 15 seconds
- Rate-limit aware: stay within Bitget's 10 req/s per UID
- Paper-trading mode: route all operations through Bitget's demo environment via `--paper-trading` flag (requires a separate Demo API Key created at bitget.com → Demo Trading → API Key Management — this is Bitget-native, not simulated by us)

### FR-3: Drift Detection + Risk Scoring

For each observation cycle, evaluate all contract rules and produce:
- Per-rule result: `pass` / `warn` / `violation`
- Composite risk score: 0–100
- Risk state: `healthy` (0–39) / `elevated` (40–69) / `critical` (70–100)

**Risk score formula (max-of-weighted-factors):**

```
risk_score = max(
  drawdown_proximity   * 40,   // (current_dd / max_dd_from_backtest) × 40
  asset_drift_count    * 25,   // number of positions/orders outside allowed set × 25 (capped at 25)
  oversize_ratio       * 20,   // (actual_exposure / margin_budget) - 1, clamped 0–1, × 20
  sharpe_degradation   * 15    // max(0, 1 - rolling_sharpe / backtest_sharpe) × 15
)
```

Max-of picks the worst dimension — a single severe violation immediately surfaces. Per-rule results feed the composite; the composite drives the risk state and alert threshold.

### FR-4: Reactive Enforcement (enforce mode only)

| Violation type | Detection method | Enforcement action |
|---|---|---|
| Asset drift | Open order or position in symbol not in `trading_symbols` | Cancel order / liquidate position |
| Position oversize | Notional exposure > `margin_budget` × multiplier | Cancel order / partial liquidate |
| Drawdown breach | Current drawdown > `max_drawdown_pct` | Liquidate via market sell |
| Unauthorized trade | Trade detected when `execution_mode` = `signal_only` | Cancel if open; alert if filled |
| Trigger order violation | Plan order targets unauthorized asset or size | Cancel plan order |

**Enforcement latency budget:**
- Detection: ≤ 15 seconds (polling interval)
- Action: ≤ 5 seconds (API call after detection)
- Total: ≤ 30 seconds worst case from event to enforcement

**Enforcement limitations (documented honestly):**
- Market orders fill instantly — cannot be cancelled. Handled via position-level enforcement after fill.
- IOC/FOK orders fill or cancel immediately — same limitation.
- Enforcement targets: GTC limit orders, plan/trigger orders, and filled positions.

### FR-5: Decision Trace + Audit Log

SQLite database storing every observation as a structured decision trace:
- Timestamp and observation cycle ID
- Full state snapshot at time of observation
- Contract rule evaluated (with origin: which backtest field derived it)
- Result: `pass` / `warn` / `violation`
- Action taken: `none` / `cancel` / `liquidate`
- Action result: `success` / `failed` with reason
- Reasoning string: human-readable explanation of what was seen and why
- Queryable by Playbook, time range, result type, action type

### FR-6: Telegram Alerts

- Custom Telegram bot (Bot API via grammy)
- Alert on: enforcement actions (immediate), drift violations in observe mode (immediate), risk state transitions (immediate)
- Message format: Playbook name, violation type, action taken, observed value vs contract bound, severity, timestamp
- Configurable: which severities and modes route to Telegram

### FR-7: Dashboard

- Per-Playbook view: behavioral contract (derived rules), current drift state, risk score, recent actions
- Portfolio view: all Playbooks at a glance, aggregate risk score, total enforcements
- Decision trace feed: chronological log of all observations with structured reasoning
- Real-time updates (SSE or polling)
- Mode switcher: toggle enforce/observe/silent per Playbook from UI

### FR-8: Operating Modes

| Mode | Detection | Alerting | Enforcement |
|---|---|---|---|
| `enforce` | Active | Active | Active — cancels orders, liquidates positions |
| `observe` | Active | Active | Disabled — alerts only, no action |
| `silent` | Active | Disabled | Disabled — logs only |

Switchable per-Playbook at runtime.

---

## Non-Functional Requirements

| Requirement | Target |
|---|---|
| Setup time | < 5 minutes from install to runtime live |
| Detection latency | ≤ 15 seconds from violation to detection |
| Enforcement latency | ≤ 30 seconds from violation to action completed |
| Alert latency | ≤ 30 seconds from detection to Telegram delivery |
| Audit retention | 30 days local SQLite |
| Dashboard load | < 2 seconds initial paint |
| Concurrent Playbooks | 1–10 monitored simultaneously |
| Availability | Local process — user responsibility for uptime |

---

## Bitget Integration Map

| Bitget Product | Integration | Data Flow |
|---|---|---|
| `getagent-skill` | HTTP API (`/api/v1/playbook/list`, `/run`) | → Backtest metrics for contract derivation |
| `bgc` / `bitget-core` | REST API (spot market, account, trade endpoints) | ↔ Live state reads + enforcement writes (cancel, sell) |
| GetClaw | Narrative complement | GetClaw delivers trading signals; ZenithPulse monitors drift and enforces contracts |

**Write operations used:**
- `POST /api/v2/spot/trade/cancel-order` — cancel single order
- `POST /api/v2/spot/trade/batch-cancel-order` — cancel multiple
- `POST /api/v2/spot/trade/cancel-symbol-order` — cancel all for symbol
- `POST /api/v2/spot/trade/cancel-plan-order` — cancel trigger order
- `POST /api/v2/spot/trade/place-order` — market sell to liquidate position

---

## Demo Scenario (3-minute video)

1. **Setup (30s):** Show a Playbook deployed via `getagent-skill` with visible backtest metrics. Start ZenithPulse — watch it derive the behavioral contract automatically. Dashboard shows: allowed symbols, drawdown cap, sizing limits. Zero config.
2. **Green state (30s):** Observer loop running. Dashboard streams live state. All checks passing. Green health scores across the board.
3. **Enforcement — Order Cancel (45s):** From terminal, run `bgc --paper-trading spot spot_place_order --orders '[{"symbol":"ETHUSDT","side":"buy","orderType":"limit","price":"2000","size":"0.1"}]'` — behavioral contract only allows BTCUSDT. ZenithPulse detects the asset drift within one polling cycle (~15s). Order cancelled via API. Dashboard shows enforcement action with decision trace. Telegram alert fires.
4. **Enforcement — Drawdown Liquidation (45s):** Simulate drawdown crossing threshold. ZenithPulse detects breach. Market sell fires to liquidate. Position closed. Risk score flips red. Second Telegram alert.
5. **Decision Trace (30s):** Open audit log. Show full decision traces: what was observed, which contract rule (derived from backtest), what action was taken, reasoning.

---

## Success Metrics

| Metric | Target |
|---|---|
| Bitget product integrations | 3 (bgc, getagent-skill, GetClaw narrative) |
| Time from install to live | < 5 minutes, zero config |
| Demo covers full loop | Derive contract → detect drift → score risk → enforce → trace → alert |
| Enforcement actions work | Cancel + liquidate demonstrated live |
| Code is integratable | README, `npm install zenithpulse`, other developers can adopt |
| Verifiable usage evidence | Decision trace log with real observations and enforcement actions |

---

## How ZenithPulse Differs from Existing Bitget Tools

| Bitget tool | What it already does | What ZenithPulse adds (doesn't exist today) |
|---|---|---|
| `getagent-skill` | Author, backtest, deploy Playbooks | Reads backtest output as a behavioral contract — turns static metrics into live enforcement rules |
| `bgc` / `bitget-core` | Execute trades, read account state on demand | Continuous polling loop that compares live state against the contract every 15s — drift detection |
| GetClaw | Deliver Playbook trade signals to Telegram | Risk-specific alerts with structured decision trace (what drifted, which rule, what action taken) |
| Bitget Dashboard | Manual portfolio view | Per-Playbook risk score, automated enforcement feed, contract-vs-reality comparison |

**Nothing in the current Bitget stack:**
- Derives rules automatically from backtest output
- Continuously compares live execution against those rules
- Scores risk as a composite signal across multiple dimensions
- Acts on violations (cancel, liquidate) without human intervention
- Produces a structured decision trace per observation

ZenithPulse is additive — it consumes Bitget's existing APIs and adds the behavioral contract + drift + enforcement + trace layer on top.

---

## Out of Scope

- Pre-execution interception of market orders (instant fill — physically impossible)
- Custom strategy authoring or backtesting
- Manual contract configuration UI (contracts are derived, not authored)
- Multi-exchange support
- Futures, margin, or options
- Dashboard authentication (single-user local)
- Sub-account isolation
- Backtesting the enforcer itself

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Playbook API key not received in time | Cannot derive behavioral contract from real backtest data | Mock the API response for demo; wire real key when available |
| API key lacks Trade permission | Enforcement writes fail | Verify key permissions early; demo in paper-trading mode |
| Rate limiting on frequent polling | Observer gets throttled | Adaptive backoff; batch reads; stay under 10 req/s |
| False positive enforcement | Cancels legitimate orders | Default to `observe` mode; require explicit opt-in to `enforce`; decision trace explains every action |
| No real trades in demo account | Cannot trigger violations | Paper-trading mode + manual order placement for demo |
| Market order fills before detection | Cannot cancel | Documented limitation; handle via position-level enforcement |

---

## Open Items

1. **Playbook API key** — pending from Bitget admin. Blocks real contract derivation but not development.
2. **Demo API key** — create a separate Demo API Key via Bitget Demo Trading UI. Required for `--paper-trading` mode in demo.
3. **Write permission test** — confirm our live key can execute cancels. Place + cancel a small limit order.
4. **Demo Playbook** — use `btc-ema-cross-demo` from getagent-skill for speed.
5. **Drift simulation** — confirm Demo environment allows placing manual orders that ZenithPulse can detect as drift and cancel.
