# Examination and monthly combined appraisal — 2026-10-19

Status: implemented and verified, uncommitted. No payments or live HR changes.
Plan: ../plans/2026-10-19-examination-combined-appraisal.md.

## Confirmed requirements

User requested department-targeted employee examinations, automatically marked
multiple-choice questions, equally weighted component scores and bonuses based
on the combined result. User explicitly clarified outside exam departments use
appraisal AND attendance, equally, rather than an appraisal-only bonus.

Exam departments: (exam% + appraisal% + attendance%)/3.
Other departments: (appraisal% + attendance%)/2.
Appraisal%=mean of eligible non-self ratings/5×100; existing attendance%=0–100.
Bonus=full unrounded combined fraction×allocation, rounded once to minor units.
Displayed combined score rounds to two decimals. All previous selected-appraiser,
no-self-rating, owner report and employee privacy rules remain intact.

## Product flow and implementation decisions

Create/open a draft colleague appraisal cycle. Enable “Include examination and
monthly attendance”, choose attendance month and exam departments, write questions
and mark correct options, save and launch. Each single-choice question has one
mark. At launch freeze definitions and assignments from employee departments.
Employees open My appraisals → their cycle, save answers or submit once, and see
the server-marked exam score. Exact submission retries are safe; no retakes.

Owner finalizes after selected appraisers and all assigned examinees submit,
the month and its published overnight shifts end, and all participants have
rated attendance. Missing attendance blocks closure; measured zero is valid.
Month/one-attempt/finalization rules are conservative implementation choices,
explained in the interface. No manual grades, timers or per-question weights.

Owner sees all final combined scores, components and bonuses; employees see only
their own. Outside exam departments have no exam prompt or zero exam penalty.
Final snapshots do not change after later attendance corrections. Cycles without
combined settings keep their original appraisal-only bonus and need no migration.

## File boundaries

- Models: server/models/PeerAppraisalExam.js, PeerAppraisalExamAttempt.js, optional
  result.composite in PeerAppraisalParticipant.js.
- Server services in server/services/peerAppraisal/: exam-rules.js owns validation,
  grading, exact arithmetic and date/shift finalization; examination.js owns draft
  config/launch/HR projection; exam-reviews.js owns private assignments and answers;
  monthly-attendance.js reuses rateAttendance in tenant month windows; exam-results.js
  prepares immutable final components. Existing lifecycle.js and queries.js integrate.
- Controller: server/controllers/peerExamination.controller.js; endpoints mounted
  under existing /api/peer-appraisals. All derive tenant/employee from authentication;
  only unrestricted HR can configure or read answer keys.
- Client: src/services/examination.service.ts and focused components/hook under
  src/app/shared/appraisals/examination/ in the admin app. Existing peer cycle,
  employee page, results card/table and My cycles integrate. Separate dirty flags
  retain both roster and exam launch guards. Revision conflicts retain local edits
  and allow explicit saved-settings reload.
- Full domain/API notes: server/services/peerAppraisal/EXAMINATION.md.

## Verification performed

- Pure rules failed before module implementation, then all 9 passed, including
  MCQ validation, key projection, exact membership, equal 2/3-component arithmetic,
  zero-vs-null attendance, tenant month boundaries, overnight guard and large money.
- Real Mongo/HTTP workflow initially failed on missing examination routes, then
  passed with actual JWT/tenant/HR middleware and a disposable local replica set:
  all 7 lifecycle tests passed. Exam department scored (50+80+100)/3=76.67 displayed
  and ₦38,333.33 bonus from ₦50K; other departments scored 90 and ₦45K bonus.
  Verified foreign department rejection, stale settings/answers, frozen config,
  unassigned submission denial, no answer keys/draft grading leak, server marking
  despite client score injection, incomplete exam/missing attendance blocking,
  owner final reports, exact retries, unchanged released snapshot after correction,
  and legacy cycle compatibility.
- Full server suite: 4,051 passed / 36 skipped / zero failures (4,087 tests).
- Admin appraisal frontend suite: 25 files / 322 tests passed. Covers authoring,
  department selection, MCQ submission, save-error retention, two-component view,
  examination closure guard, independent dirty flags and owner component reports.
- Scoped appraisal TypeScript check passed. Frontend formatting and changed-file
  whitespace check passed. Full-project type errors previously recorded outside
  appraisals remain outside this change; no full production build claimed.
- Self-review only; CodeRabbit unavailable and no subagents authorized. No live
  authenticated browser walkthrough performed. No new packages, commits or push.

Temporary database was used only for disposable tests and is stopped at session end.
Extensive unrelated local changes are preserved. Next work can start from these
files without relying on conversation history.


## Follow-up: date ranges and personalized papers (2026-10-19)

Implemented inclusive attendance dates, private Wyn City bank30,10 frozen shuffled
questions/employee (20marks), AI reviewed drafts. Latest handoff and verification:
[RESUME-examination-bank-and-range.md](RESUME-examination-bank-and-range.md).
Month-only behavior above describes historical compatibility.
