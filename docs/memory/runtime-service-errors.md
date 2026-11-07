---
name: Runtime Redis quota and realtime availability
description: Production Redis quota incident and serverless POS socket guard, 2026-10-31.
type: project
---

> Superseded runtime policy: the user requested full disconnection from Upstash
> on 2026-10-31. No quota recovery/reconnection is required. See
> `docs/memory/standalone-without-upstash.md` for the current standalone behavior.

2026-10-31 production logs show rate-limit 503s across catalogue, login and POS.
User authorized reading only production REDIS_URL and checking connectivity without
printing or saving it. Live TLS/PING succeeded; a read-only Lua `return 1` was
rejected with a provider quota category. No credentials were printed or persisted.
PING alone is insufficient to establish healthy shared limits. No paid plan,
environment change, deployment, commit or provider mutation was performed.

The configured Redis limiter remains fail-closed. Fixing retry traffic does not
restore exhausted provider quota. Renew/increase provider quota before claiming
production recovery. Do not silently disable distributed auth limits or reset to
per-instance counters. Resource dashboard and original setup live in
`docs/superpowers/specs/RESUME-upstash-setup.md`.

Redis command failures now honor the existing five-second cooldown even if the
socket is still ready. Logs emit a fixed failure category once per cooldown;
raw provider messages/URLs must never be logged. Optional caches still fall back
to authoritative reads. Connection and command deadlines remain unchanged.

Socket.IO attaches only in startServer(), which Vercel skips. `/realtime-status`
returns no-store `{available: Boolean(app.get('io'))}` outside API/DB/Redis gates.
POS/KDS probe without auth credentials before sending tokens to Socket.IO. False,
missing, invalid or failed capability probes retain REST polling; cleanup prevents
late connections. Supported servers get at most three reconnect attempts per
connector lifetime. Deploy backend before or together with admin; old backends
without the capability endpoint use REST polling. No migration required.

Handoff and test outcomes: `docs/superpowers/specs/RESUME-runtime-service-errors.md`.
