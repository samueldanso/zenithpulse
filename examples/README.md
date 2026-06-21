# Examples

Runnable scripts that demonstrate ZenithPulse against the live production server. No setup needed — just `bun` installed.

## One command — full demo

```bash
bun examples/demo-flow.ts
```

Runs the complete journey: health → playbook discovery → contract inspection → traces → mode switch → observe cycle → summary. Takes ~30 seconds.

## Individual scripts

```bash
# Check server health + observer state
bun examples/check-health.ts

# List all monitored playbooks with risk state
bun examples/list-playbooks.ts

# View decision traces (audit trail)
bun examples/get-traces.ts

# Filter traces by playbook
PLAYBOOK_ID=<id> bun examples/get-traces.ts

# Switch enforcement mode
PLAYBOOK_ID=<id> MODE=enforce bun examples/switch-mode.ts
```

## Capture verifiable usage record

```bash
# 10 minutes (default) — produces submission artifact
bun examples/capture-session.ts

# 30 minutes — stronger evidence
DURATION_MIN=30 bun examples/capture-session.ts
```

Output saved to `sample-output/session-capture.json`. This file shows:
- Continuous 15s polling with timestamps
- Real Bitget API responses (positions, orders, balance)
- Behavioral contracts derived from backtest
- Drift detection results per cycle
- Risk scores per playbook
- API call volume (~4 calls/cycle × playbook count)

## Against local server

```bash
bun examples/demo-flow.ts http://localhost:3001
bun examples/capture-session.ts http://localhost:3001
```

## What judges verify

| Evidence | Script | What it proves |
|---|---|---|
| System is live | `check-health.ts` | Observer running, uptime in hours/days |
| Real playbooks | `list-playbooks.ts` | Discovered from Bitget getagent-skill API |
| Contracts from backtest | `demo-flow.ts` | allowedSymbols, maxDrawdown, Sharpe — real data |
| Continuous monitoring | `capture-session.ts` | 15s intervals, timestamps, call volume |
| Enforcement works | `switch-mode.ts` | Mode switch live, next cycle uses new mode |
| Audit trail | `get-traces.ts` | Every decision recorded with full reasoning |
