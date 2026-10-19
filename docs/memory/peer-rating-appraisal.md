---
name: peer-rating-appraisal
description: Implemented all-colleague 1–5 rating and private score-based NGN bonuses.
updated: 2026-10-14
---

Implemented, uncommitted. User approved the design and implementation plan.
Each cycle participant rates everyone else once from 1–5. Individual NGN bonus
allocations set by unrestricted HR. Bonus = full mean / 5 × allocation; BigInt
intermediate arithmetic, final round to minor units. Roster/allocation freeze on
launch. All must submit before closure releases private own results. No payments.

Cycle mode defaults to standard; peer_rating bypasses templates/managers. New
participant/rating models and /api/peer-appraisals API. Per-author revision plus
cycle writes in transactions protect concurrent operations. Department admins do
not gain org-wide bonus access. Unavailable participants stay in the denominator.

HR: Review cycles → New colleague bonus cycle. Staff: My appraisals → Colleague
bonus appraisals. Tests: full server 3,788 passed/13 skipped; focused frontend 50
passed; disposable real Mongo integration 3 passed. Full admin suite had one
inventory sorting timeout; isolated inventory rerun 4/4 passed. Type check has
360 diagnostics outside the appraisal change. Authenticated browser walkthrough
not completed because the displayed dev login was rejected. Self-review only;
CodeRabbit unavailable; no subagents or commits.

Full handoff: `docs/superpowers/specs/RESUME-peer-rating-appraisal.md`.

Continuation: HR refresh now synchronizes persisted cycle status and suppresses
out-of-order responses. Unavailable draft employees remain removable. HR roster
saves require expectedRevision; stale edits retained until explicit discard/reload.
Exact submission retries succeed after closure without changing bonuses.
Actual JWT/tenant/HTTP workflow verified: 3/4/2 scores yielded ₦30K/₦20K/₦0.
Latest full server: 3,797 passed/13 skipped; real DB+HTTP integration 5 passed.
Complete admin/frontend rerun with two workers: 354 files/2,869 tests passed.
Earlier CPU-contention timeouts resolved without changing assertion timeouts.

Scoped appraisal TypeScript check passed; reusable config
`client/apps/admin/tsconfig.appraisals-check.json` includes real NextAuth ambient
types. Full project errors remain outside this module; no CI scripts changed.

2026-10-15: approved cycle-detail visual redesign implemented for both cycle modes.
Shared header/stages/metrics/action sidebar and clearer participant table; no
scoring or API changes. Appraisal tests 305 passed and scoped types passed.
See `docs/superpowers/specs/RESUME-appraisal-cycle-detail-design.md`.

2026-10-19: selected appraisers implemented. HR chooses appraisers from the draft
participants; at least two, no self-rating. Only selected appraisers submit, all
participants receive private results. Legacy cycles keep all-participant behavior.
See `docs/superpowers/specs/RESUME-peer-appraiser-selection.md` for verification.
Final selection verification: server 4,041 passed / 36 skipped, appraisal UI 312
passed, real Mongo/HTTP integration 6 passed, scoped types and formatting passed.

2026-10-19 examination extension: optional draft examination/monthly configuration
now combines appraisal and attendance equally, plus auto-marked MCQ score in
selected departments. Combined fraction determines bonus; original cycles with
no configuration retain old behavior. See
`docs/superpowers/specs/RESUME-examination-combined-appraisal.md` for rules and tests.
