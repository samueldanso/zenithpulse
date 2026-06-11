# Spike Findings — ZenithPulse

## 1. Architecture Decision: B (Observer) confirmed

The hackathon FAQ explicitly states: "Currently only read access is supported — order execution is not fully implemented yet." GetAgent Cloud Playbooks execute in a sandboxed runtime — there is no mechanism to route their outbound trade calls through an external proxy. Architecture A (gateway) is infeasible.

**Decision: Architecture B (Observer) — post-execution monitor.**

This is still strong for the demo because:
- Four Bitget products integrated (bgc, getagent-skill, bitget-skill-hub, GetClaw)
- "Backtest-as-policy" is a unique, Bitget-native concept
- Decision trace + risk scoring remain strong differentiators
- Alerts fire within seconds of violation, not minutes

---

## 2. getagent-skill — Backtest Output (Policy Source)

Package: `@bitget-ai/getagent-skill` (v0.2.2, npm)

### What's queryable programmatically

**GET /api/v1/playbook/list** (public, no auth for published)
Returns per-Playbook:
- `strategy_id`, `version_id`, `name`, `display_name`
- `trading_symbols` — allowed assets (e.g. `["BTCUSDT"]`)
- `backtest_support` — `full` or `none`
- `execution_mode` — `signal_only` or `follow_trade`
- `official_metrics`:
  - `total_return_pct`
  - `sharpe_ratio`
  - `max_drawdown_pct`
  - `win_rate`
  - `total_trades`

**GET /api/v1/playbook/run?run_id=...** (auth required)
Returns `metrics_output` with same fields, plus `backtest_report` with period dates.

**GET /api/v1/playbook/my-playbooks** (auth required)
Returns active deployments with `execution_mode`, `follow_trade_supported`, `status`.

### What we can derive as policy (automatic, zero config)

| Backtest field | Derived policy rule |
|---|---|
| `trading_symbols` | Allowed assets — block/flag trades outside this set |
| `max_drawdown_pct` | Drawdown cap — alert when live drawdown approaches/exceeds |
| `sharpe_ratio` | Expected Sharpe — alert on degradation below threshold |
| `total_return_pct` / `total_trades` | Position sizing envelope — flag outsized trades |
| `margin_budget` (from manifest) | Max position size — flag if live exposure exceeds |
| `execution_mode` | If `signal_only`, any direct trade is a violation |

### manifest.yaml (inside Playbook package)
- `strategy_config.margin_budget` — the per-strategy capital denominator
- `strategy_config.leverage` — declared leverage
- `strategy_config.trading_symbols` — canonical symbol list
- `schedule.cron` — execution frequency

---

## 3. bgc CLI — Live Data Surface

Package: `bitget-client` (v1.1.1, npm binary: `bgc`)

### Available read commands for observer loop

| Command | Data | Use for |
|---|---|---|
| `bgc account get_account_assets` | Spot/futures/funding balances | Portfolio value, live capital |
| `bgc spot spot_get_orders --status open` | Open orders | Position monitoring |
| `bgc spot spot_get_orders --status history` | Historical orders | Trade log, fills |
| `bgc spot spot_get_fills` | Execution details | Cost basis, actual trade sizes |
| `bgc spot spot_get_ticker --symbol X` | Live price | Mark-to-market, PnL calc |
| `bgc futures futures_get_positions` | Open futures positions | Position tracking |
| `bgc futures futures_get_funding_rate` | Funding rates | Cost monitoring |
| `bgc account get_account_bills` | Account transactions | Audit trail |

### Paper trading mode
`bgc --paper-trading <module> <tool>` — routes to demo environment. Useful for ZenithPulse demo without needing real trades.

### Programmatic access pattern
ZenithPulse can either:
1. Shell out to `bgc` and parse JSON stdout (simple, good for hackathon)
2. Import `bitget-core` directly (TypeScript) and use `BitgetRestClient` + `buildTools()` (cleaner, more control)

Option 2 is better — same code the MCP server uses, no subprocess overhead.

---

## 4. Bitget MCP Server — Available via installed tools

Already configured in this session. Provides same tools as bgc but via MCP protocol.
For ZenithPulse's server-side observer, direct API calls via `bitget-core` are more appropriate than MCP.

---

## 5. GetClaw (Telegram Bot)

- Bot: @getclaw_official_bot
- Used for: Signal delivery from Playbooks to Telegram
- Subscription binding: user provides `chat_id` during `enable` API call
- Signals delivered per-user, per-instance

### What ZenithPulse can do with GetClaw

The Playbook `enable` API stores a `chat_id`. GetClaw delivers signals to that chat. ZenithPulse's role:
- **Cannot send via GetClaw directly** — GetClaw is Bitget's managed bot
- **Can send via our own Telegram bot** — custom bot for policy alerts
- **Alternative:** Use GetClaw's webhook/notification model if exposed

**Recommendation for hackathon:** Build our own lightweight Telegram bot for policy alerts. Reference GetClaw in the narrative as "complementary — GetClaw delivers trading signals, ZenithPulse alerts on violations." For demo, show both side-by-side.

---

## 6. Skill Hub — Market Data MCP

5 analysis skills available via `bitget-skill-hub`:
- macro-analyst, market-intel, news-briefing, sentiment-analyst, technical-analysis

These use a market-data MCP server at `https://datahub.noxiaohao.com/mcp`.

**Relevance to ZenithPulse:** Could enrich risk scoring with macro/sentiment context, but not required for MVP. Could be a v2 feature: "risk score factors in macro regime."

---

## 7. Key Technical Findings

### Data flow for ZenithPulse observer loop:
```
getagent-skill API → Backtest metrics (policy derivation)
         ↓
   ZenithPulse Policy Engine (derives limits)
         ↓
bgc / bitget-core API → Live positions, orders, PnL (polling)
         ↓
   ZenithPulse Observer (compares live vs policy)
         ↓
   SQLite audit log + Dashboard + Telegram alerts
```

### Integration surface:
- `bitget-core` TypeScript library — direct dependency for API calls
- `@bitget-ai/getagent-skill` — API shape for policy derivation (HTTP calls, not library import)
- Custom Telegram bot — for policy violation alerts
- Market-data MCP — optional enrichment

### What we DON'T need to build:
- Trading execution (we're observer-only)
- Custom backtesting (we consume getagent output)
- Manual policy config (policy is derived automatically)
- Authentication/auth UI (single-user local for demo)

---

## 8. Open Questions for Refine

1. **Polling frequency:** How often to poll live positions? Every 10s? 30s? Rate limits allow 10 req/s per UID — generous.
2. **Demo Playbook:** Deploy the `btc-ema-cross-demo` example and route through ZenithPulse, or create a custom one?
3. **Violation simulation:** For demo, deliberately trigger a violation. Options:
   - Manually place a trade outside allowed symbols
   - Simulate drawdown via paper trading
   - Inject a test violation into the observer
4. **Dashboard scope:** Full Next.js app or lightweight? For hackathon, a focused dashboard with 3-4 views is sufficient.

---

## 9. Tech Stack Recommendation

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Bun | Fast, TypeScript native, user preference |
| Framework | Hono (backend) + Next.js (dashboard) | Lightweight API + rich UI |
| Database | SQLite (better-sqlite3 or drizzle) | Zero infra, audit log fits perfectly |
| API client | `bitget-core` (from agent_hub) | Same library Bitget uses, typed |
| Telegram | grammy or telegraf | Lightweight bot framework |
| Monorepo | Turborepo or simple workspace | Shared types between server/dashboard |
| Validation | Zod | Schema validation for policy rules |




