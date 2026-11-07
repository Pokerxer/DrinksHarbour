# Paperclip OpenCode bridge (agents on opencode-go GLM)

Latest: 2026-11-05. All PB agents run on `opencode-go/glm-5.3-flash` through a
shim. Quota failures from the ChatGPT/Codex account are gone. Verified company:
8/8 agents succeeded a real heartbeat on the new engine.

## Why

Paperclip pins the OpenCode CLI contract to `opencode-ai@1.18.34`
(`QUALIFIED_OPENCODE_RUNNER_VERSION` in `@paperclipai/server`, package
`@paperclipai/adapter-opencode-local`). The 1.18/1.19 npm tracks
- do not know the `opencode-go` provider (only v2 does),
- and 1.18.34 fails a trivial `opencode run` on this machine ("Unexpected server error").

The user's installed OpenCode is a Mach-O v2.2.0 binary at
`/Users/mac/.opencode/bin/opencode`; v2 dropped the `--dir <cwd>` flag the
Paperclip adapter passes to `opencode run`. Checked the Paperclip canary
(2026.1105.0-canary.5): still pins 1.18.34, so no Paperclip release currently
supports the v2 binary directly.

## The bridge

`/Users/mac/.paperclip/cli/runtimes/opencode-v2-shim/opencode` (bash shim):
- scans args for `--dir <path>` / `--dir=<path>`, removes them, `cd`s into the
  dir, `export PWD=<dir>`, then `exec`s the real v2 binary with remaining args
  (argument boundaries preserved via arrays);
- passes everything else through, so `--version` probes and `opencode models`
  discovery work for Paperclip.

Each agent adapter config:

```json
{"adapterType":"opencode_local","adapterConfig":{
  "cwd":"/Users/mac/Documents/drinksharbour",
  "model":"opencode-go/glm-5.3-flash",
  "command":"/Users/mac/.paperclip/cli/runtimes/opencode-v2-shim/opencode",
  "extraArgs":["--auto"]}}
```

`--auto` auto-approves OpenCode permissions not explicitly denied (equivalent
of the old Codex workspace-write + loopback proxy profile). Nothing else was
changed per agent; skills, instruction files and runtime config were preserved
by the `agent update` merge. Agent CLI context: specify the company via `-C` for
list commands (context profile `default` has apiBase http://127.0.0.1:3100 and
company id 8977da27-60c6-4ac5-8cf8-9eb711c93c7f persisted).

## Verification evidence 2026-11-05

- Shim smoke test: GLM completion returned OK through `--dir` translation.
- Software Engineer heartbeat: full control-plane round trip succeeded.
- All 8 agent heartbeats succeeded on the new engine (see runtime states).
- Backend Engineer initially failed resuming its old Codex session
  ("Expected a string starting with 'ses_' at [sessionID]"). Fix:
  `paperclipai agent runtime-state:reset-session <id>`, then re-wake. Its
  pre-reset run failure stays as its lastError if a later real error appears;
  the current state has a valid `ses_` session.

## Age/outdated-supersession notes

- The old loopback-EPERM findings in
  `docs/superpowers/specs/RESUME-paperclip-business-expansion.md` and the CEO
  Codex profile `drinksharbour-ceo-loopback` are historical: under OpenCode v2
  with `--auto` there is no sandbox blocking loopback binds.
- The ChatGPT usage-limit engineering pause (backend runs failing until
  2026-11-10) is superseded: quota no longer applies.
- Paperclip skill sync also injected the company skills into operator/agent
  sessions (paperclip, issue delivery, tenant review, etc.) — expected.

## Maintenance

- If the shim's argument contract breaks (Paperclip changes invocation, or the
  user upgrades Paperclip), re-check this file and the shim header.
- See `paperclipai doctor` for host checks; server on 127.0.0.1:3100.

## Run reliability history 2026-11-05 (evidence from heartbeat_runs.usage_json)

- Model identity confirmed per-run: `opencode-go/glm-5.3-flash`, biller and
  provider `opencode-go`, usage `provider_reported` — no silent fallback.
- `Go usage limit exceeded` at 07:14/07:37 UTC+1 on DRI-3 runs: the OpenCode Go
  plan cap tripped; runs fail fast until the plan period resets. Expect a
  stalled-looking company until then.
- Network drops killed several long runs: `getaddrinfo ENOTFOUND opencode.ai`
  (09:03/12:59/13:02) and `ECONNRESET` mid-response (08:56/11:57). Retries
  restart from a fresh session, re-ingesting the full context (single runs
  observed at 192k input / 6.6M cache-read / 43k output). Possible VPN/DNS
  interference on this Mac (Windscribe, hide.me installed) — unstable
  connection to opencode.ai wastes whole runs.
- Cost shows `costUsd: 0` because Paperclip has no price list for
  opencode-go/GLM; usage counts are authoritative, dollars are not.