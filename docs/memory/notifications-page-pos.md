---
date: 2026-10-08
status: implemented-local-verification-complete
---

# Notifications page POS redesign

Approved design: `docs/superpowers/specs/2026-10-08-notifications-page-pos-design.md`.
Resume and verification: `docs/superpowers/specs/RESUME-notifications-page-pos.md`.

Admin `/notifications` now has a red POS hero, four statistics, category tabs, quick date/unread/urgent chips, local search and priority filters, collapsible Lagos date groups, checked-row reads and a responsive detail panel. The page loads at most 500 notices using the existing GET endpoint. The header keeps its own existing paginated hook/list. Safe action destinations are shared in `inbox-filters.ts`.

`modifiedCount` from read-all is a marked-record count: subtract from unread total; do not use it as the remaining unread total (a corrected ambiguity in the source design). Mutation events retain the existing `user.id:tenantId` detail format. No server endpoint changes or new dependencies.

Verification: whole admin suite 261 files / 2,510 tests passed with two workers; notification-focused tests (35), focused types and lint passed. Full-project types/lint still fail outside notifications. Browser tooling fails at startup; no visual verification claimed.

## Improvement pass

Added category colors and readable names, mobile timestamps/read state, complete quantity and sales evidence, filtered-unread select-all/clear selection, keyboard tab navigation and mobile dialog focus handling. Empty results distinguish filters and failed loads. Filter changes clear ticks; bulk requests contain only unread IDs from the current filtered view. `currentUnits` represents sales, while `available` represents stock. Evidence remains limited to approved public metadata, with no fabricated predictions or internal rule labels.

Improvement verification: 43 notification tests passed; whole admin rerun 262 files / 2,517 tests passed, plus the later bulk-filter regression in the focused run. Focused TypeScript and lint clean. Browser preview remains unavailable. No commit or deployment.

2026-10-09: shared design and functional summary cards extended to all notification
pages. Inbox sorting is in the filter toolbar; summary cards filter unread, urgent
and actionable notices. Clear all also resets ordering. Category search/sorting
runs before server pagination. Details and verification live in
notifications-shared-design.md and RESUME-notifications-shared-design.md.
