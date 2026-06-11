# Spec: ZenithPulse

## Objective

Build an autonomous runtime that derives behavioral contracts from Bitget Playbook backtest output, monitors live execution for drift, scores risk, enforces reactively, and traces every decision — so developers deploying Playbooks have visibility and protection without writing any config.

**Users:** Solo developers running 1–5 Playbooks on Bitget GetAgent Cloud.

**Success looks like:** `npm install zenithpulse` + API key → contract derived, drift detected, enforcement active, decision trace flowing — all within 5 minutes, zero configuration.

---

## Tech Stack

| Layer | Choice | Version |
|---|---|---|
| Runtime | Bun | ≥1.1 |
| Backend framework | Hono | ^4 |
| Dashboard | Next.js | ^16 (App Router) |
| Database | SQLite via Drizzle ORM | `bun:sqlite` driver |
| API client | `bitget-core` (local, from Agent Hub) | source import |
| Telegram bot | grammy | ^1 |
| Validation | Zod | ^3 |
| Styling | Tailwind CSS v4 + shadcn/ui | latest |
| Monorepo | Bun workspaces | native |
| MCP server | `@modelcontextprotocol/sdk` | ^1 |
| CLI | `citty` | ^0.1 |

---

## Commands

```bash
# Root (monorepo)
bun install                        # install all workspace deps
bun run dev                        # start server + dashboard concurrently
bun run build                      # build all packages
bun run lint                       # biome lint across all packages
bun run format                     # biome format across all packages
bun run check                      # biome check (lint + format)
bun run test                       # vitest across all packages
bun run typecheck                  # tsc --noEmit across all packages

# Server (@zenithpulse/server)
bun run --filter @zenithpulse/server dev       # start Hono server (port 3001)
bun run --filter @zenithpulse/server test      # server tests only

# Dashboard (@zenithpulse/dashboard)
bun run --filter @zenithpulse/dashboard dev    # start Next.js (port 3000)
bun run --filter @zenithpulse/dashboard build  # production build

# CLI (@zenithpulse/cli)
bunx zenithpulse start             # start runtime (server + dashboard)
bunx zenithpulse start --mcp       # start runtime + expose MCP server on stdio
bunx zenithpulse status            # show runtime health + active playbooks
```

---

## Integration Surface

This is how developers and agents integrate with ZenithPulse. The dashboard is a dev console — not the product. The product is the runtime and these integration surfaces.

### REST API + API Key

ZenithPulse server exposes a REST API on `:3001`. Secured with a bearer token (`ZENITHPULSE_API_KEY`). Any service, script, or agent can call it:

```bash
# Register a playbook for monitoring
curl -X POST http://localhost:3001/api/playbooks \
  -H "Authorization: Bearer $ZENITHPULSE_API_KEY" \
  -d '{"playbookId": "btc-ema-cross"}'

# Get current risk score
curl http://localhost:3001/api/playbooks/btc-ema-cross \
  -H "Authorization: Bearer $ZENITHPULSE_API_KEY"

# Subscribe to live events
curl -N http://localhost:3001/api/events \
  -H "Authorization: Bearer $ZENITHPULSE_API_KEY"
```

### MCP Server

ZenithPulse exposes an MCP server. Any agent platform that supports MCP can call ZenithPulse tools directly — no REST client, no SDK.

**Start:**
```bash
bunx zenithpulse start --mcp
```

Or add to your MCP client config (Claude, cursor, etc.):
```json
{
  "mcpServers": {
    "zenithpulse": {
      "command": "bunx",
      "args": ["zenithpulse", "start", "--mcp"],
      "env": { "ZENITHPULSE_API_KEY": "..." }
    }
  }
}
```

**Tools exposed:**

| Tool | Description |
|---|---|
| `get_risk_score` | Get current risk score + state for a Playbook |
| `get_contract` | Get the derived behavioral contract |
| `list_traces` | Query decision trace history |
| `set_mode` | Switch operating mode (observe/enforce/silent) |
| `get_health` | Runtime health + active playbook count |

### CLI

```bash
bunx zenithpulse start             # start server + dashboard
bunx zenithpulse start --mcp       # also expose MCP server on stdio
bunx zenithpulse status            # show runtime health
```

### SKILL.md

ZenithPulse serves a machine-readable integration guide at `GET /skill.md`. No auth required.

Pass the URL to your coding agent:
> "Configure ZenithPulse using the guide at http://localhost:3001/skill.md"

The file covers: product description, MCP config JSON block, all 5 MCP tools with input params and examples, REST API curl examples with auth, CLI quick start. Served as a static Hono route from `packages/server/src/static/skill.md`.

---

## Project Structure

```
zenithpulse/
├── package.json                 # workspace root
├── biome.json                   # shared lint/format config
├── tsconfig.json                # base tsconfig
├── .env                         # API keys (gitignored)
├── .env.example                 # template without secrets
├── context/                     # locked planning docs
├── tasks/                       # active build artifacts (plan.md, tasks.md)
│
├── packages/
│   ├── server/                  # @zenithpulse/server
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config.ts
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts              # bearer token validation
│   │   │   ├── contract/
│   │   │   │   ├── derive.ts
│   │   │   │   └── schema.ts
│   │   │   ├── observer/
│   │   │   │   ├── loop.ts
│   │   │   │   ├── poller.ts
│   │   │   │   └── state.ts
│   │   │   ├── drift/
│   │   │   │   ├── detect.ts
│   │   │   │   ├── score.ts
│   │   │   │   └── types.ts
│   │   │   ├── enforce/
│   │   │   │   ├── engine.ts
│   │   │   │   ├── actions.ts
│   │   │   │   └── types.ts
│   │   │   ├── trace/
│   │   │   │   ├── record.ts
│   │   │   │   └── types.ts
│   │   │   ├── alerts/
│   │   │   │   ├── telegram.ts
│   │   │   │   └── types.ts
│   │   │   ├── static/
│   │   │   │   └── skill.md             # machine-readable agent integration guide
│   │   │   ├── mcp/
│   │   │   │   ├── server.ts            # MCP server setup
│   │   │   │   └── tools.ts             # tool definitions + handlers
│   │   │   ├── db/
│   │   │   │   ├── schema.ts
│   │   │   │   ├── migrate.ts
│   │   │   │   └── client.ts
│   │   │   ├── api/
│   │   │   │   ├── routes.ts
│   │   │   │   ├── playbooks.ts
│   │   │   │   ├── traces.ts
│   │   │   │   ├── events.ts
│   │   │   │   └── modes.ts
│   │   │   └── bitget/
│   │   │       ├── client.ts
│   │   │       └── playbook-api.ts
│   │   └── tests/
│   │       ├── contract/
│   │       ├── drift/
│   │       ├── enforce/
│   │       ├── trace/
│   │       └── mcp/
│   │
│   ├── cli/                     # @zenithpulse/cli
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts         # citty CLI entry point
│   │       ├── commands/
│   │       │   ├── start.ts     # start runtime (+ --mcp flag)
│   │       │   └── status.ts    # health check
│   │       └── bin.ts           # bin entry: #!/usr/bin/env bun
│   │
│   ├── dashboard/               # @zenithpulse/dashboard
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx
│   │       │   ├── page.tsx
│   │       │   ├── playbooks/[id]/page.tsx
│   │       │   └── traces/page.tsx
│   │       ├── components/
│   │       │   ├── risk-score.tsx
│   │       │   ├── contract-view.tsx
│   │       │   ├── trace-feed.tsx
│   │       │   ├── mode-switcher.tsx
│   │       │   └── alert-badge.tsx
│   │       ├── lib/
│   │       │   ├── api.ts
│   │       │   └── sse.ts
│   │       └── hooks/
│   │           └── use-playbooks.ts
│   │
│   └── shared/                  # @zenithpulse/shared
│       └── src/
│           ├── types.ts
│           └── constants.ts
│
└── .resources/
    └── agent_hub/               # Bitget Agent Hub source (reference)
```

---

## Code Style

**One real example showing the style:**

```typescript
// packages/server/src/drift/score.ts
import type { BehavioralContract, LiveState } from "@zenithpulse/shared";

interface RiskFactors {
  drawdownProximity: number;
  assetDriftCount: number;
  oversizeRatio: number;
  sharpeDegradation: number;
}

function computeRiskFactors(
  contract: BehavioralContract,
  state: LiveState,
): RiskFactors {
  const drawdownProximity =
    state.currentDrawdown / contract.maxDrawdownPct;

  const assetDriftCount = state.openPositions.filter(
    (p) => !contract.allowedSymbols.includes(p.symbol),
  ).length;

  const oversizeRatio = Math.max(
    0,
    state.totalExposure / contract.marginBudget - 1,
  );

  const sharpeDegradation = Math.max(
    0,
    1 - state.rollingSharpe / contract.backTestSharpe,
  );

  return { drawdownProximity, assetDriftCount, oversizeRatio, sharpeDegradation };
}

export function computeRiskScore(
  contract: BehavioralContract,
  state: LiveState,
): number {
  const f = computeRiskFactors(contract, state);
  return Math.min(
    100,
    Math.max(
      f.drawdownProximity * 40,
      Math.min(f.assetDriftCount, 1) * 25,
      Math.min(f.oversizeRatio, 1) * 20,
      f.sharpeDegradation * 15,
    ),
  );
}
```

**Conventions:**
- Named exports only (no default exports)
- Types in dedicated `types.ts` per module; shared types in `@zenithpulse/shared`
- Zod schemas for all external data boundaries (API responses, env vars)
- Explicit return types on exported functions
- No classes — plain functions and objects
- No `any`, `@ts-ignore`, or `@ts-expect-error`
- Biome handles formatting (tabs, semicolons, trailing commas — biome defaults)
- File naming: kebab-case (`risk-score.ts`, not `riskScore.ts`)
- Function naming: camelCase
- Type naming: PascalCase
- Constants: SCREAMING_SNAKE_CASE

---

## Testing Strategy

**Framework:** Vitest (via `bun run test`)

**Test locations:** Mirror source structure under `tests/` per package.

**What to test:**
| Level | What | Where |
|---|---|---|
| Unit | Contract derivation logic, risk score computation, drift detection | `packages/server/tests/contract/`, `tests/drift/` |
| Unit | Enforcement decision logic (given drift result → expected action) | `packages/server/tests/enforce/` |
| Unit | Decision trace assembly | `packages/server/tests/trace/` |
| Integration | Observer loop with mocked Bitget API responses | `packages/server/tests/observer/` |
| Integration | API routes return correct shapes | `packages/server/tests/api/` |
| Manual | Dashboard renders live data, mode switching works | Dev browser |

**What NOT to test:**
- Bitget API itself (external — mock at boundary)
- Database operations (Drizzle ORM — trust the library)
- UI pixel layout (visual, not functional)

**Coverage target:** Core logic (contract, drift, score, enforce) ≥ 80%. API routes and glue code — tested via integration, not coverage-driven.

**Test approach:** Pure functions for all logic. Side effects (API calls, DB writes, Telegram sends) isolated behind interfaces and injected — making unit tests trivial without DI frameworks.

---

## Architecture

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                          ZenithPulse Server                           │
│                                                                      │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────┐    │
│  │  Playbook   │    │  Observer    │    │   Drift Detection    │    │
│  │  API Client │───▶│  Loop       │───▶│   + Risk Scoring     │    │
│  │  (getagent) │    │  (15s poll) │    │                      │    │
│  └─────────────┘    └──────────────┘    └──────────┬───────────┘    │
│         │                  ▲                        │                │
│         ▼                  │                        ▼                │
│  ┌─────────────┐    ┌─────┴────────┐    ┌──────────────────────┐    │
│  │ Behavioral  │    │  Bitget API  │    │   Enforcement        │    │
│  │ Contract    │    │  (bitget-    │    │   Engine             │    │
│  │ Derivation  │    │   core)      │    │   (enforce mode)     │    │
│  └─────────────┘    └──────────────┘    └──────────┬───────────┘    │
│                                                     │                │
│                     ┌──────────────┐                │                │
│                     │  Decision    │◀───────────────┘                │
│                     │  Trace +     │                                 │
│                     │  Audit Log   │──────▶ SQLite                   │
│                     └──────┬───────┘                                 │
│                            │                                         │
│                            ▼                                         │
│                     ┌──────────────┐    ┌──────────────────────┐    │
│                     │  Telegram    │    │   Hono API           │    │
│                     │  Alerts      │    │   (REST + SSE)       │    │
│                     └──────────────┘    └──────────┬───────────┘    │
│                                                     │                │
└─────────────────────────────────────────────────────┼────────────────┘
                                                      │
                                              ┌───────▼───────┐
                                              │  Next.js      │
                                              │  Dashboard    │
                                              │  (port 3000)  │
                                              └───────────────┘
```

### Observer Loop Lifecycle (single cycle)

```
1. Poll Bitget API → build LiveState snapshot
2. Load current BehavioralContract
3. Run drift detection: compare LiveState vs Contract → DriftResult[]
4. Compute risk score from DriftResult[]
5. IF mode=enforce AND violations exist → run enforcement actions
6. Build DecisionTrace (state + rules + results + actions + reasoning)
7. Persist trace to SQLite
8. Emit SSE event to connected dashboard clients
9. IF mode≠silent AND violations exist → fire Telegram alert
10. Sleep until next interval
```

### Key Types

```typescript
// @zenithpulse/shared/src/types.ts

type OperatingMode = "enforce" | "observe" | "silent";

type RiskState = "healthy" | "elevated" | "critical";

type RuleResult = "pass" | "warn" | "violation";

type EnforcementAction = "none" | "cancel_order" | "cancel_plan_order" | "close_position";

interface BehavioralContract {
  playbookId: string;
  derivedAt: string;                    // ISO timestamp
  allowedSymbols: string[];             // from trading_symbols
  maxDrawdownPct: number;               // from backtest max_drawdown_pct
  backTestSharpe: number;               // from backtest sharpe_ratio
  marginBudget: number;                 // from manifest margin_budget
  executionMode: "signal_only" | "follow_trade";
  expectedReturnPct: number;            // from total_return_pct
  totalTrades: number;                  // from total_trades
}

interface LiveState {
  timestamp: string;
  accountBalance: number;
  openOrders: Order[];
  openPlanOrders: PlanOrder[];
  positions: Position[];                // derived from fills + balances
  currentDrawdown: number;              // computed from peak vs current
  totalExposure: number;                // sum of position notional values
  rollingSharpe: number;                // computed from recent returns
}

interface DriftResult {
  ruleId: string;
  ruleName: string;
  contractField: string;                // which backtest field derived this rule
  result: RuleResult;
  observedValue: number | string;
  contractBound: number | string;
  severity: number;                     // 0–1 normalized
}

interface DecisionTrace {
  id: string;
  cycleId: string;
  playbookId: string;
  timestamp: string;
  liveStateSnapshot: LiveState;
  contractSnapshot: BehavioralContract;
  driftResults: DriftResult[];
  riskScore: number;
  riskState: RiskState;
  enforcementAction: EnforcementAction;
  actionTarget?: string;                // orderId or symbol
  actionResult?: "success" | "failed";
  actionError?: string;
  reasoning: string;                    // human-readable explanation
}
```

---

## Database Schema

```sql
-- Playbooks being monitored
CREATE TABLE playbooks (
  id TEXT PRIMARY KEY,                   -- playbook strategy_id
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'observe',  -- enforce | observe | silent
  contract_json TEXT,                    -- serialized BehavioralContract
  contract_derived_at TEXT,
  last_observed_at TEXT,
  risk_score REAL DEFAULT 0,
  risk_state TEXT DEFAULT 'healthy',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Decision traces (one per observation cycle per playbook)
CREATE TABLE traces (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  playbook_id TEXT NOT NULL REFERENCES playbooks(id),
  timestamp TEXT NOT NULL,
  live_state_json TEXT NOT NULL,         -- serialized LiveState
  drift_results_json TEXT NOT NULL,      -- serialized DriftResult[]
  risk_score REAL NOT NULL,
  risk_state TEXT NOT NULL,
  enforcement_action TEXT NOT NULL DEFAULT 'none',
  action_target TEXT,
  action_result TEXT,
  action_error TEXT,
  reasoning TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_traces_playbook ON traces(playbook_id, timestamp DESC);
CREATE INDEX idx_traces_action ON traces(enforcement_action) WHERE enforcement_action != 'none';
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/playbooks` | List all monitored Playbooks with current risk state |
| GET | `/api/playbooks/:id` | Single Playbook detail (contract, risk score, last trace) |
| PATCH | `/api/playbooks/:id/mode` | Switch operating mode `{ mode: "enforce" }` |
| GET | `/api/playbooks/:id/contract` | Current behavioral contract for a Playbook |
| GET | `/api/traces` | Decision trace feed (paginated, filterable by playbook/action/result) |
| GET | `/api/traces/:id` | Single trace detail |
| GET | `/api/events` | SSE stream — emits `trace`, `risk_state_change`, `enforcement_action` events |
| GET | `/api/health` | Runtime health check |
| GET | `/skill.md` | Agent integration guide (no auth required) |

---

## Environment Variables

```bash
# Required — ZenithPulse API
ZENITHPULSE_API_KEY=              # Bearer token for REST API + MCP auth

# Required — Bitget Trading API
BITGET_API_KEY=***                # Live or Demo API key
BITGET_SECRET_KEY=***             # Corresponding secret
BITGET_PASSPHRASE=                # API passphrase

# Required — Playbook API (when key received)
PLAYBOOK_ACCESS_KEY=              # getagent-skill ACCESS-KEY

# Required — Telegram
TELEGRAM_BOT_TOKEN=***            # Bot API token from @BotFather
TELEGRAM_CHAT_ID=                 # Target chat for alerts

# Optional — Configuration
POLL_INTERVAL_MS=15000            # Observer loop interval (default: 15000)
MODE_DEFAULT=observe              # Default operating mode (default: observe)
PAPER_TRADING=false               # Use Bitget demo environment (default: false)
PORT=3001                         # Server port (default: 3001)
DB_PATH=./data/zenithpulse.db     # SQLite file path
PLAYBOOK_MARGIN_BUDGET=100        # Fallback margin budget (USDT) — not in list API response
```

---

## Boundaries

### Always do:
- Run `bun run check` (biome) before commits
- Run `bun run test` before commits
- Validate all external API responses with Zod before use
- Log every enforcement action to SQLite before executing it
- Default new Playbooks to `observe` mode
- Include `reasoning` string in every decision trace
- Rate-limit Bitget API calls to stay under 10 req/s per UID

### Ask first:
- Switching a Playbook to `enforce` mode (UI requires confirmation)
- Adding new npm dependencies
- Changing the database schema
- Modifying polling interval below 10 seconds
- Any change to enforcement logic (cancel/close position)

### Never do:
- Commit `.env` or any file containing secrets
- Suppress TypeScript errors (`as any`, `@ts-ignore`)
- Execute enforcement in `observe` or `silent` mode
- Place buy orders (ZenithPulse only cancels or sells-to-close)
- Call Bitget write endpoints without prior drift detection result justifying the action
- Ship without decision trace working (it's the audit guarantee)

---

## Success Criteria

1. **Contract derivation works:** Given a Playbook ID, the system fetches backtest metrics and produces a valid `BehavioralContract` in < 5 seconds.
2. **Drift detection works:** When live state deviates from contract (wrong symbol, oversize, drawdown breach), drift is detected within one polling cycle (≤ 15s).
3. **Risk score is correct:** Score follows the defined formula. Score 0 when all rules pass. Score ≥ 70 when drawdown exceeds 100% of backtest max.
4. **Enforcement works (enforce mode):** Violating futures orders are cancelled via `futures_cancel_orders`. Drawdown-breaching positions are closed via `futures_place_order` (tradeSide:close). Action completes within 30s of violation.
5. **Decision trace is complete:** Every observation cycle persists a trace with: state snapshot, contract, drift results, risk score, action (if any), reasoning.
6. **Alerts fire:** Telegram message sent within 30s of detection in enforce/observe mode. Message includes playbook name, violation type, values.
7. **Dashboard shows real-time state:** Portfolio view loads in < 2s. Updates within 15s of state change via SSE.
8. **Mode switching works:** Changing mode from dashboard or via API immediately affects next observation cycle.
9. **REST API is authenticated:** All endpoints reject requests without a valid `Authorization: Bearer <ZENIT...EY>` header.
10. **MCP server works:** `bunx zenithpulse start --mcp` starts the runtime and exposes all 5 MCP tools. A client calling `get_risk_score` receives the current score.
11. **CLI works:** `bunx zenithpulse start` starts server + dashboard. `bunx zenithpulse status` returns runtime health.
12. **Zero config runtime:** Only env vars (API keys) + Playbook ID. No YAML, JSON, or rule files needed.
13. **Demo scenario executable:** The 3-minute demo from PRD can be performed end-to-end in paper-trading mode.
14. **SKILL.md served:** `GET /skill.md` returns a machine-readable integration guide. An agent loading this URL can configure and call ZenithPulse without additional docs.

---

## Open Questions

1. **Rolling Sharpe computation** — ~~30-day rolling~~ → Rolling last 20 trades (or 24h, whichever has more data). Faster signal, demonstrable in demo. Resolved.
2. **Peak tracking for drawdown** — Track peak from when ZenithPulse starts monitoring, or attempt to reconstruct from historical account data? Proposal: start-of-monitoring peak (simpler, defensible).
3. **Multiple Playbooks on same account** — If two Playbooks trade the same symbol, how to attribute which Playbook "owns" which order? Proposal: for hackathon, single-Playbook mode is the default. Multi-Playbook attribution is listed as future work.
4. **Contract re-derivation** — If backtest metrics update (Playbook re-deployed), auto-update contract or require manual trigger? Proposal: auto-update on 5-minute interval, log the change as a trace event.
