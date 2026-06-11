# Brief — ZenithPulse

## What we're building
An autonomous risk enforcement and observability runtime for Bitget Playbooks. ZenithPulse uses the backtest envelope as the policy contract and live execution drift as the risk signal — deriving behavioral contracts automatically, scoring risk per-Playbook in real time, enforcing reactively when violations occur, and maintaining a structured decision trace for every observation.

## For who
Developers deploying Playbooks to Bitget GetAgent Cloud who need risk infrastructure — enforcement, observability, and audit — without writing custom policy config for every strategy.

## Problem
Bitget's stack covers authoring (`getagent-skill`), backtesting, deployment, and execution (`bgc`, GetClaw). But once a Playbook is live, there is no risk infrastructure. It can drift from its backtest envelope — oversize positions, trade unintended assets, breach drawdown limits — with no detection, no scoring, no enforcement, and no audit trail. Developers have no visibility during execution and no automated defense against drift.

## Why now
Bitget shipped the full agent stack but risk infrastructure for autonomous trading agents is the unsolved gap. The hackathon explicitly scopes Track 2 to fill infrastructure gaps. A runtime that uses backtest-as-policy for both observability and enforcement is a Bitget-native idea that doesn't exist outside this ecosystem.

## Core idea
ZenithPulse is risk infrastructure for Bitget Playbooks. It reads each Playbook's backtest metadata from `getagent-skill` — allowed assets, max position size, drawdown cap, expected Sharpe — and derives a behavioral contract automatically. No config files.

The runtime continuously monitors live execution against the contract:

- **Drift detection** — polls live state via `bitget-core` every 10–15 seconds, compares against the behavioral contract
- **Risk scoring** — composite per-Playbook risk score updated in real time
- **Decision trace** — every observation logged with structured reasoning (what was seen, which rule applied, result)
- **Reactive enforcement** — when violations are detected in `enforce` mode:
  - Open orders outside policy → cancelled
  - Filled positions breaching drawdown → liquidated via market sell
  - Plan/trigger orders violating rules → cancelled before trigger fires
- **Alerts** — Telegram notification within seconds of any violation or enforcement action

A Next.js dashboard shows per-Playbook health, portfolio rollup, risk scores, enforcement actions, and the full audit trail in real time.

## In scope
- **Backtest-as-policy**: derive behavioral contracts from `getagent-skill` output automatically — zero manual config.
- **Drift engine**: poll `bitget-core` for live positions, orders, PnL every 10–15 seconds. Detect deviation from contract.
- **Risk scoring**: composite per-Playbook risk score, portfolio-level aggregate.
- **Reactive enforcement**: auto-cancel violating orders, auto-liquidate breaching positions (in `enforce` mode).
- **Decision trace**: structured forensic record per observation — what was seen, which rule applied, what happened.
- **Audit log**: SQLite — every observation persisted with pass/violation result, enforcement action, reasoning.
- **Alerts**: Telegram Bot API — violations, enforcement actions, drawdown breaches, Sharpe degradation.
- **Three modes**: enforce (detect + act), observe (detect + alert only), silent (log only).
- **Dashboard**: Next.js — per-Playbook health, portfolio rollup, risk scores, enforcement feed, audit trail.
- Spot trading only (futures deferred).
- Reference demo: one Playbook deployed and monitored/enforced through ZenithPulse end-to-end.

## Out of scope
- Pre-execution interception (market orders fill instantly — enforcement is reactive, not pre-flight).
- Building our own Playbook or trading strategy.
- Custom backtesting (use `getagent-skill` backtest output as source of truth).
- Manual policy config UI (contracts are derived, not authored).
- Sub-account isolation (v2 — too much setup friction for hackathon).
- Futures, margin, options.
- Multi-exchange support.
- Dashboard authentication (single-user local for demo).

## Demo path
- Judge sees a Playbook deployed via `getagent-skill` with its backtest output visible.
- ZenithPulse reads the backtest and surfaces the derived behavioral contract automatically — no config written.
- Live dashboard shows per-Playbook risk score streaming. Drift engine active. All green.
- Playbook places a limit order on an asset outside its contract — drift detected, risk score degrades, enforcement fires (order cancelled). Decision trace logged. Telegram alert fires.
- Drawdown crosses backtest threshold — enforcement liquidates the position via market sell. Risk score flips red. Second alert.
- Audit log view opens — structured decision trace shows: observed state, contract rule (derived from backtest), enforcement action, reasoning.

## Success looks like
- Integrates three Bitget products: `bgc` (live state + enforcement writes), `getagent-skill` (backtest → contract derivation), GetClaw (narrative complement for alerts).
- `npm install zenithpulse` + Playbook API key = risk infrastructure live within 5 minutes, zero config.
- 3-minute demo shows: backtest-as-policy derivation → drift detection → risk scoring → reactive enforcement → decision trace → Telegram alert. End-to-end.

## Architecture

**Reactive Enforcement + Observability Runtime (confirmed feasible)**

ZenithPulse polls Bitget for live execution state via `bitget-core` and compares against the behavioral contract derived from `getagent-skill`. The runtime provides both observability (continuous) and enforcement (reactive):

**Observability layer (always active):**
- Drift detection against behavioral contract
- Per-Playbook risk scoring
- Structured decision trace per observation
- Audit log with full state snapshots
- Dashboard with real-time updates

**Enforcement layer (active in `enforce` mode):**
- Limit orders (GTC): detected and cancelled before fill (10–30s latency)
- Plan/trigger orders: detected and cancelled before trigger fires
- Filled positions breaching policy: liquidated via market sell
- Market orders: cannot be intercepted (instant fill) — handled via position-level enforcement after fill

**Three modes:**
- `enforce` — detect + act (cancel orders, liquidate positions) + alert
- `observe` — detect + alert only, no action taken
- `silent` — log only, no alerts, no action

**Technical basis:**
- `spot_cancel_orders` — cancel single, batch, or all orders for a symbol
- `spot_cancel_plan_orders` — cancel pending trigger orders
- `spot_place_order` (sell side) — liquidate spot positions
- All confirmed as callable write operations in `bitget-core`
- API key requires `Trade` permission (standard Bitget API key setup)

**What makes this different from a dashboard:**
- It has a **behavioral contract** derived from backtest — not arbitrary thresholds
- It **acts** — cancels orders, liquidates positions
- Every observation has a **structured decision trace** — auditable, explainable
- **Risk scoring** is continuous and composite, not binary pass/fail
