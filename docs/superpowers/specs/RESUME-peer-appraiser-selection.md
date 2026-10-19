# Selected appraisers — 2026-10-19

Status: implemented and verified. Uncommitted.
Plan: ../plans/2026-10-19-peer-appraiser-selection.md.

## Confirmed scope and behavior

User wants to choose who may appraise everyone, and confirmed that appraisers
come from the employees being appraised. Each draft participant has a “Can
appraise colleagues” checkbox alongside their bonus allocation. Selected
appraisers rate every other participant, excluding themselves; employees who are
not appraisers still receive their score and bonus when HR closes the cycle.
Require at least two appraisers so each can receive a non-self incoming rating.
Permissions, roster and allocations freeze on launch; existing launched cycles
retain their original permissions. There are no payment actions in this feature.

Bonus remains the full mean of actual incoming ratings / 5 × individual
allocation, rounded once to minor units. Appraisers receive N−1 incoming ratings
from the N selected appraisers; non-appraisers receive N. Never treat missing
ratings as zero, and never wait on non-appraisers before closure.

## File boundaries and contracts

- `server/models/PeerAppraisalParticipant.js`: isAppraiser defaults to true.
  Missing flags on legacy lean documents also mean true; no backfill required.
- `server/services/peerAppraisal/rules.js`: roster entries accept optional boolean
  isAppraiser, reject other types and require at least two appraisers.
- `lifecycle.js`: persists choices with the roster transaction/revision guard;
  validates at launch and closes only on submitted selected appraisers with the
  exact required rating matrix. All subjects receive calculated results.
- `reviews.js`: non-appraisers cannot save or submit, even by direct API request.
- `queries.js`: HR gets appraiserTotal separately from subject total; submitted
  counts selected appraisers only. Employee /my and /review include isAppraiser;
  non-appraisers get an empty assignment and retain their private own result.
- `client/apps/admin/src/services/peerAppraisal.service.ts`: optional flag/count
  fields support legacy payloads; roster writes send explicit appraiser flags.
- `peer-rating/use-cycle-setup.ts` and `setup-employee.tsx`: focused state and
  controls extracted from the original large setup file. Atomic save/reload
  includes appraiser choices; stale edits require explicit discard/reload.
- `cycle-workspace/peer-actions.tsx`, `peer-summary.tsx`, participant table and
  cycle panel distinguish subject counts from appraiser submissions.
- Employee page and My cycles show a waiting-for-results state to non-appraisers;
  they retain closed-result access and are not prompted to submit ratings.

## Verification

- New rules/model/projection tests: observed 4 failures before implementation,
  then all 12 passed after the implementation.
- Selected-appraiser HTTP lifecycle test: observed missing appraiserTotal failure
  before implementation; disposable Mongo replica-set integration then passed
  all 6 tests. Two appraisers / three participants produced scores 4, 5, 2 and
  bonuses ₦40,000, ₦25,000, ₦4,000 from allocations ₦50,000, ₦25,000, ₦10,000.
  Non-appraiser draft/submit requests return 403; foreign-tenant requests return
  404; self-rating, premature closure and post-launch edits are rejected.
- Legacy persisted records were explicitly unset of isAppraiser in integration
  to prove all-participants appraisal continues working without migration.
- UI regressions failed first for selection/closure/waiting view, then all
  22 appraisal files / 312 tests passed. Includes stale-permission reload and
  selection changes invalidating an open launch confirmation.
- Scoped appraisal TypeScript check passed; touched frontend formatting passed.
- Changed-file whitespace check passed. A full-workspace diff check found an
  unrelated existing CRLF/trailing-space change in platform next-env.d.ts;
  that file was not changed by this task.
- Full server suite passed with local networking enabled: 4,041 passed, 36
  skipped, 0 failures (4,077 total). Initial sandbox run could not bind localhost;
  no assertions/timeouts were relaxed to address that harness restriction.
- Final setup-only rerun after copy polish: 7 tests passed.
- Self-review covered tenant authority, Boolean validation, exact pairs, legacy
  flags, draft save guards and private result access. CodeRabbit unavailable;
  no external review or subagents. Live authenticated browser not verified.

Disposable test Mongo was stopped after integration. No live HR data was changed.
Extensive unrelated local changes were present and left untouched.

## Owner scores and denominator follow-up

User additionally requested that the owner see everyone's final scores and that
scores be based on the total appraisers. Existing owner-authorized HR participant
endpoint and closed-cycle table already expose every participant's aggregate
score and bonus, including employees who are not appraisers.

User confirmed: divide by eligible appraisers, excluding themselves. For 10
selected appraisers, appraisers divide by 9; other participants divide by 10.
This matches the existing exact-rating-matrix closure and calculation; formula
and stored results are preserved. Implemented a visible denominator line beside
each final score in participant-table.tsx using its stored result.ratingCount,
with a brief closed-cycle explanation in cycle-panel.tsx.

Fresh follow-up verification: 23 appraisal UI files / 315 tests passed, 15 peer
server unit/compatibility/access tests passed, scoped TypeScript passed. The
new table regression failed first on the missing denominator, then passed.
It covers every employee’s score, different appraiser/non-appraiser denominators,
pre-close result hiding and missing-result honesty. A 9-versus-10 perfect-rating
regression proves both groups can earn 5/5 and the full bonus. No backend product
code or live data changed; the prior full server/Mongo results above remain from
the selected-appraiser implementation. Self-review and changed-file whitespace
check passed; no new dependencies, subagents or commits.
