# Notifications expiry — 2026-10-12

User requested functionality and logic improvements to /notifications/expiry.
Implemented safe batch details, expiry statuses, future expiry-date ranges and
chronological sorting before pagination, plus recipient/batch scan deduplication
that preserves read state. Daily scan: 02:00 Lagos; approved tenants only.
Expired/quarantined advice requires stock review. No real tenant scan or inventory
mutation was performed. Automatic minimum refresh remains 12-hour scheduled.

Resume: docs/superpowers/specs/RESUME-notifications-expiry.md.
Rules: server/services/expiryAlerts/README.md and admin notifications/expiry/README.md.

Verified: 14 focused expiry backend regressions; full backend 3,732 passed/five
skipped; full admin 2,719 passed in 314 files. Scoped types/lint, format, syntax
and changed-file whitespace passed. Visual browser verification unavailable.
