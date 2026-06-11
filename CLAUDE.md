# ZenithPulse

Autonomous runtime that derives behavioral contracts from Bitget Playbook backtest output, monitors live execution for drift, scores risk, enforces reactively, and traces every decision.

Hackathon: Bitget AI Base Camp S1 — Track 2 (Trading Infra).

## Project Context

- **Architecture:** Reactive Enforcement + Observability Runtime (observer-based, with write capability)
- **Deadline:** Submission window Jun 15–25, 2026
- **Demo:** 3-minute video showing contract derivation → drift detection → risk scoring → enforcement → decision trace → alert
- **Blocker:** Waiting on Playbook API key (ACCESS-KEY) from Bitget admin

## Workflow

```
Brief → Setup & Spike → Refine Brief → PRD → SPEC → Plan → Build
```

Current stage: **Plan** (signed off) → next is **Build**

## Agent Skill System

Skills are provided via the `agent-skills` plugin (already installed). Do NOT install or copy them manually.

Load `using-agent-skills` at the start of every session to discover which skill applies.

### Intent → Skill Mapping

- New feature / functionality → `spec-driven-development` → `incremental-implementation` + `test-driven-development`
- Planning / breakdown → `planning-and-task-breakdown`
- Bug / unexpected behavior → `debugging-and-error-recovery`
- Code review → `code-review-and-quality`
- Refactor / simplify → `code-simplification`
- API / interface design → `api-and-interface-design`
- UI work → `frontend-ui-engineering`
- Security concerns → `security-and-hardening`
- Committing / branching → `git-workflow-and-versioning`
- Deploying / shipping → `shipping-and-launch`
- CI/CD pipeline → `ci-cd-and-automation/`
- Docs → `documentation-and-adrs`

### Lifecycle

```
DEFINE  → spec-driven-development
PLAN    → planning-and-task-breakdown
BUILD   → incremental-implementation + test-driven-development
VERIFY  → debugging-and-error-recovery
REVIEW  → code-review-and-quality
SHIP    → shipping-and-launch
```

### Slash Commands

- `/spec` — DEFINE: spec before code
- `/plan` — PLAN: small, atomic tasks
- `/build` — BUILD: one slice at a time
- `/test` — VERIFY: tests are proof
- `/review` — REVIEW: improve code health
- `/code-simplify` — REFACTOR: clarity over cleverness
- `/ship` — SHIP: faster is safer

### Rules

- Always invoke the matching skill before implementing anything
- Never skip directly to code — DEFINE → PLAN → BUILD order is enforced
- One slice at a time: implement → test → verify → commit → next slice
- Tasks already broken down in `tasks/tasks.md` — use `/build` per task

## Key Files

- `context/brief.md` — Project brief (locked)
- `context/spike-findings.md` — Setup & spike results (done)
- `context/prd.md` — Product requirements (locked)
- `context/spec.md` — Technical specification (locked)
- `tasks/plan.md` — Implementation plan (current)
- `tasks/tasks.md` — Vertical-slice task breakdown, 31 tasks (current)
- `context/bitget-hack-s1.md` — Hackathon rules reference
- `.resources/agent_hub/` — Bitget Agent Hub source (reference)

## Tech Stack

- Runtime: Bun (≥1.1)
- Backend: Hono ^4
- Dashboard: Next.js ^16 (App Router)
- Database: SQLite via Drizzle ORM (`bun:sqlite`)
- API client: `bitget-core` (local import from `.resources/agent_hub`)
- Telegram: grammy ^1
- Validation: Zod ^3
- Styling: Tailwind CSS v4 + shadcn/ui
- Monorepo: Bun workspaces
- Linting: Biome

## Bitget Integration Points

- `bgc` / `bitget-core` — Live positions, orders, PnL (polling) + enforcement writes (cancel, sell)
- `getagent-skill` API — Backtest metrics for behavioral contract derivation (HTTP)
- GetClaw — Narrative complement (Bitget signals), we build own bot for risk alerts

## Environment

- Trading API keys in `.env` — working (verified)
- Playbook API key — pending admin
- Demo API key — needed for paper-trading mode (separate from live key)
- bgc CLI — available via npx

## Commands

```bash
# Monorepo (once built)
bun install
bun run dev                        # server + dashboard (Next.js runs with --bun flag)
bun run check                      # biome lint + format
bun run test                       # vitest
bun run typecheck                  # tsc --noEmit

# Bitget CLI (testing)
npx bgc spot spot_get_ticker --symbol BTCUSDT
npx bgc account get_account_assets
```

## Constraints

- Spot trading only (futures deferred)
- No manual policy config (contracts are derived from backtest automatically)
- Single-user local dashboard (no auth for demo)
- Enforcement is reactive — cannot intercept market orders (instant fill)
- Never place buy orders — ZenithPulse only cancels or sells-to-close
- Default mode is `observe` — `enforce` requires explicit opt-in
- No `as any`, `@ts-ignore`, `@ts-expect-error`
- Follow official documentation practices when scaalfolding or installing anything
- Write clear, concise and reaabable commit mesages, avoid using T1 L1 etc as commit mesages and nams which dont make sens in PR to team other temebers

## Locked Vocabulary

- **Headline:** "Autonomous risk enforcement and observability runtime for Bitget Playbooks"
- **Thesis:** "Uses the backtest envelope as the policy contract and live execution drift as the risk signal"
- **Components:** Backtest-as-policy, Behavioral contract, Drift engine, Risk scoring, Reactive enforcement, Decision trace, Alerts, Three modes (enforce/observe/silent)
- Do NOT change this framing. Observability is 70% of the build.
