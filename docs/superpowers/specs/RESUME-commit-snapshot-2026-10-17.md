# Repository snapshot — 2026-10-17

User requested a commit of all current changes on `feat/plan-entitlements-billing`.
The snapshot covers admin accounting, sales, inventory, notifications, appraisals,
catalogue workflows, storefront search/location/purchases, backend services and
regression tests, shared sales money helpers, and existing documentation.

## Commit preparation

- Replaced a hard-coded database URI in `server/tax-survey.js` with required
  `MONGODB_URI`/`MONGO_URI` configuration. Rotate the previously embedded credential.
- Removed five extra trailing blank lines reported by staged whitespace checks.
- CodeRabbit CLI unavailable; no automated CodeRabbit review performed.
- Storefront Node suite: 132 passed.
- Admin full Vitest suite: 3,110 passed; two 5-second timeouts in
  `inventory-movements-browser.test.tsx`. Isolated rerun: three passed; sorting test still timed out at 5 seconds.
- Backend rerun with local-server access: 3,970 passed, zero failed, 16 skipped.
  The earlier sandbox run failed HTTP fixtures because they could not bind ports.
- Staged whitespace checks passed; survey script syntax check passed.
- Build and TypeScript checks were not run for this commit-only request.

No push or deployment requested. Domain-specific handoffs remain authoritative.
