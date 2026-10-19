# Examination and combined scores

A draft peer cycle may include examination/attendance settings. Without these,
legacy colleague-rating bonuses remain unchanged. The owner selects departments and individual recipients,
inclusive attendance start/end dates and a bank of single-choice questions.
New editor assignments contain 10 questions. Owners set each question’s marks
(whole numbers1–20), optionally label difficulty, and choose1–240 minutes to answer
(default30 for new/edited drafts). Questions have2–6 distinct options and one key.

## Question sources and assignment

Wyn City HR can choose **Use Wyn City question bank**, review the 30 supplied
questions/keys/marks, choose attendance dates/departments/duration and save. The
supplied bank defaults to2 marks per question; owners may edit those marks. Source:
`server/data/examinations/wyn-city-drinks-30.json`, extracted from the user's
updated Wyn City PDF. All supplied keys retained; Q7's missing currency glyph is
normalized to ₦. The preset is server-only, restricted to tenant slug `wyncity`;
metadata is absent for other tenants and employees cannot fetch it.

HR may generate 10–50 draft questions from a topic with Anthropic's official SDK,
using `claude-haiku-4-5` (or `EXAMINATION_AI_MODEL`) and `ANTHROPIC_API_KEY`.
AI supplies difficulty through constrained JSON output. The server normalizes
case/whitespace and assigns easy1, medium2, hard3. Missing or inconsistent model
marks no longer discard an otherwise valid bank; answer indexes are never guessed. The screen shows the model,
keys, difficulty and marks for review. Owners may override marks after acceptance. **Use generated
questions** accepts them into the editable bank; **Save examination settings**
persists it. Generation itself never saves, launches or sends employee data/PDFs.
SDK network retries remain zero. One controlled application repair is allowed
for invalid/incomplete generated banks, with45seconds per call and60seconds total.
A repair sends only original topic/count and a controlled validation reason, never
the rejected answer key. Refusals/provider/network failures are not retried.
Inputs and outputs remain bounded; per-user/tenant limit is5requests/15minutes
(each request can make at most2provider calls). Invalid output leaves saved data
intact. Count, key, difficulty, truncation and provider errors have specific safe
messages instead of the previous generic invalid-bank catch-all.

At launch, each assigned employee gets a random sample without replacement in
shuffled order, frozen as question IDs on their attempt. Independent samples can
overlap. Reloads/draft saves retain the same paper. Options are not shuffled.
Only those assigned questions are returned/accepted for grading. Legacy launched
attempts without question IDs keep the full historical paper; old month-only
settings remain readable and default marks stay one. No migration is required.

## Scoring and attendance

Appraisal percentage = unrounded average eligible colleague rating / 5 × 100.
Selected exam recipients: equal mean of exam%, appraisal%, attendance%.
All other participants, including unchecked employees in selected departments:
equal mean of appraisal% and attendance% (no zero exam).
Exam percentage uses earned marks / maximum marks of that employee’s assigned
questions ×100. Mixed-weight samples can have different maximum marks. Both the
exam grade and exact rational combined bonus use marks, not raw correct counts.
Legacy results without weighted snapshots retain their correct/question fraction.
Bonus = full unrounded combined fraction × individual minor-unit allocation.
BigInt rational arithmetic rounds the bonus once; displayed scores round to two
decimals. No payment is made by this feature.

Attendance bounds are inclusive tenant calendar dates (1–366 days); queries end
at the following local midnight, exclusively. Existing rateAttendance rules use
published shifts, punctuality, clock-outs, durations and approved leave. The period
and any published overnight shift starting in it must finish before closure.
Every participant needs rated attendance: null blocks closure; measured zero is
valid. Final snapshots include date bounds/components/bonus/calculatedAt. Later
attendance corrections do not rewrite released results.

## Boundaries and API (under /api/peer-appraisals)

Configuration requires unrestricted HR, JWT tenant and expected cycle revision.
Settings/keys/departments/recipients freeze at launch. The participant department refreshes
from the tenant employee at launch, then freezes; selected departments must reach
at least one cycle participant. All appraisers and exam assignees must submit.

- PUT /:cycleId/examination: draft settings + expectedRevision; enabled:false
  removes combined settings. Date-only saves remove a stale attendanceMonth.
- GET /:cycleId/examination/bank/:bankId: draft-only private preset, Wyn City HR.
- POST /:cycleId/examination/generate: draft-only HR topic/count → validated draft.
- POST /:cycleId/examination/start: own explicit start; idempotent server deadline.
- GET /:cycleId/examination: own public questions and own draft/grade; no keys.
  Timed exams hide questions/IDs before start, while showing count/max/duration.
- PATCH /:cycleId/examination: own answer snapshot + expectedRevision.
- POST /:cycleId/examination/submit: complete own answers + expectedRevision.

Own endpoints derive tenant/employee from authentication. Drafts reveal no score
or correct counts. Final submissions are immutable; exact retries are idempotent
including after closure. Changed/unassigned/cancelled writes are rejected.
HR participants includes config/progress and permitted preset metadata. Owner sees
all final scores; employees see only their own result. Separate unsaved roster/exam
flags prevent either save from accidentally unlocking launch. Bank loading blocks
saving until the load finishes, preserving attendance edits made during the request.

## Timed attempts

Duration is copied to the assigned attempt at launch. Explicit Start examination
stores server startedAt/expiresAt once, using the existing cycle transaction.
Repeat starts, reloads and client-provided timestamps cannot extend it. Legacy
launched attempts without duration remain untimed; no backfill is needed.

Only requests accepted before expiresAt can change answers. The UI autosaves timed
answers after edits, preserves newer local edits during an in-flight save, shows
saved/unsaved/error status and locks at expiry. Manual early submission still
requires every answer. Expiry grades only answers previously saved by the server;
unanswered questions score zero. Connectivity failures cannot grant extra time.

At expiry, own reads/writes, owner progress reads or cycle close finalize pending
attempts. Finalization is serialized through the cycle transaction; no background
scheduler is required. submittedAt records the deadline for timed-out attempts,
and earnedMarks/maxMarks/timedOut freeze the grade. Late writes return that final
grade without accepting additional answers. Closure settles expired started papers
before readiness; unstarted assigned employees still block closure. Cancellation
blocks start/writes and the interface never retries finalization on cancelled cycles.

Continuation and verification: docs/superpowers/specs/RESUME-weighted-timed-examinations.md.


## Examination interface

Management settings use a responsive configuration/readiness layout. Shared client
validation names incomplete dates, overlong attendance ranges, invalid durations,
missing departments, insufficient banks, bad marks/options/keys and duplicate
prompts before Save is enabled. Server validation remains authoritative.
Question bank search matches prompts/options and supports difficulty filters;
filtered editing keeps original question positions/keys/marks. Clear filters and
empty states help owners find and repair questions. All editing is HR-only.

Employee paper shows answered/remaining count, completion bar and question
navigation with focus, a next-unanswered action and clear selected-answer styles.
Submit examination opens an in-page review; Confirm submission sends the immutable
submission. Keep answering preserves choices. Countdown/autosave remain active
through review; expiry removes confirmation actions and loads the server result.
Mobile fieldsets explicitly allow shrinking to prevent horizontal overflow.
UI handoff: docs/superpowers/specs/RESUME-examination-usability.md.


Dropdown controls use a shared Headless UI Listbox for difficulty, correct answer,
bank filters and AI-template department. Menus portal outside scroll containers,
fit viewport width/height and support keyboard/Escape/outside dismissal. Labels and
selected value context remain available to assistive technology. Selecting a
question difficulty does not overwrite its marks; correct answers show real option
text. Handoff: docs/superpowers/specs/RESUME-appraisal-dropdowns.md.


AI reliability implementation and verified SDK schema compatibility:
[RESUME-examination-ai-reliability.md](../../../docs/superpowers/specs/RESUME-examination-ai-reliability.md).
Structured JSON schema uses only provider-supported features: objects with
additionalProperties:false,required fields,integer index enum,enum difficulty,
arrays withminItems:1. Count/string/numeric length limits remain server-validated;
unsupported min/max schema constraints would cause provider400 errors.


Selecting examination departments shows a live employee recipient preview from
active,eligible draft cycle selections. Names/counts group by department and track
unsaved roster additions/removals; unsaved status is explicit. Department data is
minimal string|null on the existing unrestricted-HR eligible-employees response.
The preview includes individual recipient checkboxes, select-all and clear.
Omitted `recipientIds` preserves legacy assignment to all matching departments.
New editor saves persist exact checked IDs when roster data is loaded. Explicit
lists must be nonempty, distinct, valid IDs of active tenant employees in the saved
cycle roster and selected departments. Save and launch both validate membership;
a removed roster member or changed department blocks launch until corrected.
No bank or answer key is exposed by recipient selection. Only selected recipients
get attempts or count toward exam completion on closure.

An explicit selection never automatically adds new department/roster candidates.
Deselected departments are pruned from explicit choices; effective saved choices
also intersect the current draft roster. Save roster changes before examination
settings. A successful local roster save supplies its revision to the examination
editor while retaining unsaved recipient edits; a refresh/discard of the roster
does not bypass examination conflict protection.
Handoff: docs/superpowers/specs/RESUME-exam-recipient-selection.md.
