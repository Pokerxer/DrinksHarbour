---
name: POS realtime availability
description: Probe actual backend socket support before POS/KDS connections.
type: project
---

The backend exposes /realtime-status outside API/DB gates, returning a no-store
boolean based on its actual attached Socket.IO server. Vercel handler instances
report unavailable. The endpoint exposes no tenant, token or provider information.

POS and KDS share a bounded, cancellable capability probe without credentials.
False/missing/invalid/failed probes retain existing REST polling. A successful
probe permits the existing authenticated socket, with at most three reconnect
attempts per connector lifetime. Cleanup prevents late connections after unmount.
Deploy backend support before or alongside admin; older backends retain polling.

Reviewed checks: seven connector tests plus two backend capability tests pass in
an isolated checkout. No admin-wide build claim or deployment is made. Review:
docs/audits/commit-readiness-2026-11-02.md.
