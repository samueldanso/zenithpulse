# ZenithPulse — Submission TODO

CC2 audit: 2026-06-20. Against `hack-rules.md`, `bitget-hack-s1.md`, and `spec.md`.
Deadline: Jun 25, 24:00 UTC+8.

---

## P0 — Disqualification Risk (Must fix today)

### [ ] Fix Render deploy — `.resources/agent_hub` missing from git clone

`packages/server/src/bitget/client.ts:2` imports from `../../../../.resources/agent_hub/...` but `.resources` is gitignored. Render clones from git → import fails → server crashes.

**Fix:** Switch `render.yaml` to Docker deploy (Dockerfile already copies `.resources`). Change `runtime: node` to use the Dockerfile. OR vendor `bitget-core/src/client/` into the repo.

### [ ] README — complete rewrite

Current: 1-line placeholder. Rules say: "README must include installation steps, integration instructions, usage examples — another developer must be able to run it independently." Auto-reject without this.

**Must include:**

- What problem it solves (1 paragraph)
- Install steps (`bun install`, env vars)
- Quick start (`bun run dev`)
- Integration guide (REST API curl examples, MCP config JSON, SKILL.md URL)
- Bitget products integrated (bgc, getagent-skill, GetClaw)
- Architecture overview (text or diagram)
- Deployment instructions (Docker, Render, Vercel)

---

## P1 — Required Submission Materials

### [ ] Demo video — 3 min max (required for Track 2)

Record showing:

1. Setup / install (30s)
2. Contract derivation from backtest — zero config (30s)
3. Drift detection + risk scoring live (45s)
4. Enforcement action: order cancelled or position closed (45s)
5. Decision trace / audit log (30s)

Post as public tweet, submit link in form.

### [ ] Verifiable usage record

Run server in paper-trading mode for 10+ minutes. Capture:

- API call logs with timestamps + call volume
- OR sample input/output (trace JSON export)
- OR curl session showing REST responses with real observation data

At least one of these is required per rules.

### [ ] Project description — four-part structure

Write for submission form:

1. **Problem** — No risk infrastructure for live Bitget Playbooks; strategies can drift with no detection, scoring, or enforcement
2. **Solution** — Autonomous runtime that derives behavioral contracts from backtest output, monitors execution, scores risk, enforces reactively, traces decisions
3. **Core logic** — Backtest envelope IS the policy contract; live execution drift IS the risk signal; enforcement is reactive, not pre-flight
4. **Demo/evidence** — Deployed URL (Render + Vercel) + API call log + demo video

### [ ] Add `ALLOWED_ORIGINS` to render.yaml + .env.example

Dashboard on Vercel will get CORS rejections without this. Once the Vercel URL is known, set it.

```yaml
- key: ALLOWED_ORIGINS
  value: "https://zenithpulse-dashboard.vercel.app"
```

---

## P2 — Quality & Completeness

### [ ] Separate MCP entry point from HTTP server

`startMcpServer()` uses stdio transport but runs alongside Hono HTTP. `console.log` calls corrupt the MCP protocol stream. Local MCP config in SKILL.md is broken.

**Fix:** Create `packages/server/src/mcp-entry.ts` that only boots MCP + DB (no Hono, no observer, logs to stderr). Update SKILL.md config to point to this entry.

### [ ] Complete SKILL.md content

Missing vs spec:

- REST API curl examples with auth
- CLI quick start section
- Auth setup instructions

Judges or agents hitting `GET /skill.md` should be able to integrate without other docs.

### [ ] Fix 17 failing tests

Root causes:

- `drizzle-orm` `desc` export issue with Bun test runner (trace store tests)
- `vi.stubGlobal` / `vi.unstubAllGlobals` not in Bun's native test (playbook-api tests)
- Observer loop import issues

85/102 pass. TypeScript and Biome pass clean. These aren't logic bugs — they're test infra compat issues.

### [ ] Community tweet for +50 USDT participation award

- Repost Bitget official post: https://x.com/Bitget_AI/status/2061719206106919039
- Publish project intro tagged #BitgetHackathon and @Bitget_AI
- Submit tweet links in submission form

---

## P3 — Polish (If Time Allows)

### [ ] Auth middleware

Spec says all REST endpoints require `Authorization: Bearer` header. `ZENITHPULSE_API_KEY` is in config but never checked. Not blocking for hackathon (reduces friction for judges) but is a spec deviation.

### [ ] `rollingSharpe` computation

Hardcoded to 0 in `poller.ts:35`. Sharpe degradation rule never fires. Acceptable for demo if noted honestly.

### [ ] Telegram alerts

`grammy` in deps, `stubAlert()` in observer loop. Unwired. Would strengthen demo (show alert firing in real time alongside enforcement).

### [ ] `get_contract` MCP tool

Spec lists it; implementation has `list_playbooks` instead. Minor — current tool set covers the demo.

---

## Submission Form Fields to Prepare

- [ ] Project name: ZenithPulse
- [ ] Track: Track 2 — Trading Infra
- [ ] Project description (four-part structure — see P1 above)
- [ ] GitHub repo link (must be PUBLIC before submit)
- [ ] Deployment link (Render server URL + Vercel dashboard URL)
- [ ] Verifiable usage record link (trace export or API log)
- [ ] Demo video tweet link
- [ ] Bitget UID (must match registration)
- [ ] Engagement tweet link (for Community Impact Award)

---

## What's Done — No Work Needed

- [x] Core logic: contract derivation, drift detection, risk scoring, enforcement, traces
- [x] Shared types package (spec-aligned)
- [x] Database schema + Drizzle migrations
- [x] Observer loop with 15s interval polling
- [x] SSE event streaming
- [x] Bitget API integration (futures read + write, real keys verified)
- [x] Dashboard pages (portfolio overview, playbook detail, mode switcher)
- [x] Docker Compose for self-hosted
- [x] Biome lint: 0 issues
- [x] TypeScript: 0 errors
- [x] Vercel config for dashboard
- [x] render.yaml + Dockerfile (need the Docker deploy fix above)
- [x] `GET /skill.md` endpoint (needs content completion)
- [x] MCP server with 5 tools (needs separate entry point)
- [x] `.env.example` with all required vars documented
- [x] 85 passing tests covering core logic

---

## Sprint Schedule

| Day            | Focus                                                       | Deliverable           |
| -------------- | ----------------------------------------------------------- | --------------------- |
| Jun 20 (today) | Fix deploy (Docker on Render) + ALLOWED_ORIGINS + MCP entry | Live URLs working     |
| Jun 21         | README rewrite + SKILL.md + project description             | Submission text ready |
| Jun 22         | Run live 12+ hrs paper-trading, collect usage evidence      | Verifiable record     |
| Jun 23         | Record demo video, post community tweet                     | Required media done   |
| Jun 24         | Fix tests, final polish, submit form                        | Submitted             |

---

## Open Questions

1. How does this project work in a real-life scenario for the demo — no mocks? (Use `/teach-me` on the codebase.)
2. What's the TL;DR?
3. [x] How do MCP and SKILL.md work? — RESOLVED:
   - `packages/mcp/` published to npm (`zenithpulse-mcp@1.0.1`), `/mcp` Streamable HTTP on Hono server
   - Root `SKILL.md` with YAML frontmatter, served at `GET /skill.md`
   - Published to npm + remote URL — both `npx zenithpulse-mcp` and `"url": ".../mcp"` work
4. [x] Final spec.md reconciliation — RESOLVED:
   - Telegram, GetClaw, CLI: not implemented, removed from docs (honest)
   - Rolling Sharpe: hardcoded to 0, noted as P3
   - Auth middleware: skipped for judge friction, noted as P3
   - Tool names: `get_risk_state` vs spec's `get_risk_score` — minor, kept as-is
   - All docs now only claim what the code does
5. [ ] Consider adding `zenithpulse/scripts`, `/docs`, or `VISION.md`.
6. [ ] Create `AGENTS.md` — a README for autonomous agents working on this codebase (agent guidelines). For `CLAUDE.md`: keep it gitignored for local dev, or clean it up and point to `@AGENTS.md` for reference (like in `/dashboard`).
7. [x] final readme revamp — RESOLVED:
   - Professional header (logo, centered tagline, badges)
   - Plain language Problem/Solution, hybrid component table
   - Agent Integration moved above Quick Start (judge flow)
   - Loop diagram (Watch → Detect → Score → Act → Record)
   - Removed unimplemented features from all docs
