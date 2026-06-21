# Examples

Runnable scripts that demonstrate ZenithPulse in action. All scripts work against the live deployed server by default, or pass a local URL as argument.

## Quick test (no setup needed)

```bash
bun examples/check-health.ts
bun examples/list-playbooks.ts
bun examples/get-traces.ts
```

## Full demo flow

```bash
# 1. Check server is running
bun examples/check-health.ts

# 2. List discovered playbooks
bun examples/list-playbooks.ts

# 3. View decision traces (audit trail)
bun examples/get-traces.ts

# 4. Switch a playbook to enforce mode
PLAYBOOK_ID=<id> MODE=enforce bun examples/switch-mode.ts

# 5. Capture a session (verifiable usage record for submission)
DURATION_MIN=10 bun examples/capture-session.ts
```

## Against local server

```bash
bun examples/check-health.ts http://localhost:3001
bun examples/list-playbooks.ts http://localhost:3001
```

## Sample output

After running `capture-session.ts`, captured data is saved to `sample-output/`. This serves as the "verifiable usage record" required for hackathon submission.
