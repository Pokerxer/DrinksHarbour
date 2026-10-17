# Minimum refresh every twelve hours — 2026-10-12

User supersedes previous inbox-on-read minimum refresh. Current behaviour:
background tenantDemandForecast job at 00:00/12:00 Africa/Lagos calculates and
persists eligible automatic minima using sales + posted net transfer-out demand.
Inbox catch-up scans saved minima only. Warehouse/demand/restock page controllers
set useSavedMinimum and disable persistence; promotions protected stock also uses
saved targets. Forecast demand still uses authorized sales. Saved-mode caches
are distinct from calculation caches and saved mode never persists policies.
No new formula, desktop automation, tenant-pivot authority or duplicate scheduler.

Handoff: docs/superpowers/specs/RESUME-minimum-refresh-cadence.md.
Earlier inbox automatic-minimum on-read notes are historical and superseded.

Verified: backend 3,721 passed / five skipped; admin 2,718 passed in 313 files.
Scoped types, formatting/syntax/whitespace passed. No live tenant operations.
