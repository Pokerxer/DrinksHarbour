# All-colleague bonus appraisal

Attendance can use an explicit employee planning `weekly_quota` policy instead
of a dated shift roster. The tenant-scoped monthly/range scorer loads that policy
from the employee. Only complete Monday–Friday weeks fully inside the selected
range count, with weekly credit capped at the target. Unfinished/partial weeks
are excluded; absent days are weekly deficits, not invented dated shifts.
Default employees retain published-shift scoring. See
`docs/superpowers/specs/RESUME-wyncity-attendance-scores.md` for deployment state.

HR selects appraisers from the employees being appraised in a draft cycle. Each
selected appraiser rates every other participant once, with one integer 1–5.
Require at least two appraisers so every participant receives an incoming rating.
No self rating. All belong to one authenticated tenant. Only unrestricted HR may
manage the business-wide roster or read allocations/results across employees.

Store NGN in integer minor units. Without examination/monthly settings, bonus uses
unrounded mean / 5 × allocation. New combined calculations use appraisal40%,examination40%,attendance20%;
non-exam employees use appraisal80%,attendance20%. Released results keep their
saved scores and weights (legacy snapshots retain equal weighting). Details and API boundaries: [EXAMINATION.md](./EXAMINATION.md).
Draft ratings never produce published results. Close only with every selected appraiser
submitted and all required appraiser-to-other-participant rating pairs present. Transactions touch the cycle
revision to serialize mutations; stale forms receive 409. Launch freezes roster, appraiser permissions
and allocations. Inactive/deleted participants never disappear from a launched
cycle: cancel if completion becomes impossible. Cancellation does not pay bonuses.

Non-appraisers cannot save or submit ratings, including through direct API calls;
they retain access to their own results. Only the author can read outgoing ratings. Own final results are released on
closure; no incoming individual ratings are exposed. With only two appraisers, each
appraiser’s aggregate inherently reveals their single incoming rating.

Draft roster PUTs include expectedRevision from the HR participants response.
A stale save returns 409 without replacing allocations; HR can explicitly discard
local edits and reload the saved roster. Unavailable draft participants remain
visible/removable. Progress refresh uses persisted status and ignores older
responses. Identical submission retries succeed even after closure; changed
ratings and cancelled-cycle writes remain rejected.

Participant `isAppraiser` defaults to true. Missing flags on legacy documents are
also treated as true at every service boundary, so no backfill is required.
Roster PUT accepts an optional boolean isAppraiser per participant (omitted means
true); invalid types and fewer than two appraisers are rejected. HR progress
exposes total participants and appraiserTotal separately; submitted counts selected
appraisers only. Employee /my and /review expose the employee's isAppraiser flag;
non-appraisers get no colleague assignment or outgoing ratings in /review.

## Employee workspace

The employee page `/appraisals/peer/[cycleId]` searches/filters colleague choices
without altering assignment membership. Save draft preserves the returned review
revision; final submission requires a review screen and explicit confirmation.
Unselected appraisers and closed/cancelled cycles have no editing controls. Exam
assignment remains independent from appraiser permission: `hasExamination` signals
cycle configuration; the own examination endpoint decides access. Loaded cycle
content stays visible when result refresh fails. See
`docs/superpowers/specs/RESUME-employee-peer-workspace.md` for UI verification.


Owner employee names open the unrestricted-HR scores endpoint. It exposes only
aggregate exam/appraisal/attendance values with explicit pending/provisional states,
never draft ratings,keys or reviewer identities. See EXAMINATION.md for endpoint
and weighting rules. Handoff: docs/superpowers/specs/RESUME-employee-score-breakdown.md.

Closed peer cycle owner headers offer Download results PDF. It prints fresh
authorized saved snapshots, preserves historical weights, and never recalculates
attendance or bonuses. Handoff: docs/superpowers/specs/RESUME-cycle-results-pdf.md.
