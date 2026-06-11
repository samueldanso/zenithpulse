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

Current stage: **Build** (T1 scaffold complete, docs locked)

**Key decisions locked:**
- Perpetual futures (USDT-margined) — not spot
- Enforcement: `futures_cancel_orders` + `futures_place_order` (tradeSide:close) — no spot sell
- Webhooks: cut. Replaced with SKILL.md agent integration guide (`GET /skill.md`)
- `margin_budget` not in list API → fallback: `PLAYBOOK_MARGIN_BUDGET` env var
- `signal_only` Playbooks → enforcement disabled, observability on
- Playbook API auth: `ACCESS-KEY: <key>` header — NOT `Authorization: Bearer`

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

- `bgc` / `bitget-core` — Futures positions, orders, PnL (polling) + enforcement writes via mix endpoints (`futures_cancel_orders`, `futures_place_order` tradeSide:close). Target: USDT-margined perpetual futures.
- `getagent-skill` API — Backtest metrics for behavioral contract derivation (HTTP, `ACCESS-KEY` header — NOT Bearer)
- GetClaw — Narrative complement (Bitget signals), we build own bot for risk alerts

## Environment

- Trading API keys in `.env` — working (verified)
- Playbook API key — obtained (`PLAYBOOK_ACCESS_KEY`)
- `PLAYBOOK_MARGIN_BUDGET` — fallback for margin_budget (not in list API response)
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

# Bitget CLI (testing — futures)
npx bgc mix futures_get_positions --productType USDT-FUTURES
npx bgc account get_account_assets
```

## Deployment (Locked)

This is a production infra product, not a local-only demo. Judges have 500 submissions and 1 week — they click URLs, they don't clone repos.

- **Server + Observer** → Render (persistent disk at `/data` for SQLite, Bun runtime, always-on)
- **Dashboard** → Vercel (Next.js, public URL judges can visit)
- **Docker Compose** → self-hosted story (`docker compose up` → full stack)
- **MCP server** → exposed from server, connects to deployed Render instance
- **SKILL.md** → served at `GET /skill.md` on live Render URL (no auth)

**Critical build constraints from this decision:**
- Dashboard API client MUST use configurable `NEXT_PUBLIC_API_URL` env var (NOT hardcoded localhost)
- Server must accept `0.0.0.0` binding (not just localhost)
- SKILL.md and MCP config must reference the deployed URL
- SQLite path via `DB_PATH` env var (Render mounts persistent disk at `/data`)

## Constraints

- Perpetual futures only (USDT-margined). Spot deferred.
- No manual policy config (contracts are derived from backtest automatically)
- Enforcement is reactive — cannot intercept market orders (instant fill)
- Never place buy orders — ZenithPulse only cancels orders or closes positions (tradeSide:close)
- Default mode is `observe` — `enforce` requires explicit opt-in
- `signal_only` Playbooks → enforcement disabled, observability + risk scoring remain active
- No `as any`, `@ts-ignore`, `@ts-expect-error`
- No outbound webhook delivery (not in scope)
- Follow official documentation practices when scaffolding or installing anything
- Write clear, concise commit messages — one line, max 72 chars, `type(scope): description`, imperative, no period

## Locked Vocabulary

- **Headline:** "Autonomous risk enforcement and observability runtime for Bitget Playbooks"
- **Thesis:** "Uses the backtest envelope as the policy contract and live execution drift as the risk signal"
- **Components:** Backtest-as-policy, Behavioral contract, Drift engine, Risk scoring, Reactive enforcement, Decision trace, Alerts, Three modes (enforce/observe/silent)
- Do NOT change this framing. Observability is 70% of the build.
