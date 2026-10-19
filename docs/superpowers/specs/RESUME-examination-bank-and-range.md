# Examination bank and attendance ranges — 2026-10-19

Status: implemented and verified locally; uncommitted. User requested date-range selection, AI question
generation, the supplied Wyn City bank now, and 10 shuffled questions per employee.
Plan: ../plans/2026-10-19-examination-bank-and-range.md.

Source PDF read in full with pdftotext; rendered first page and management key
for visual confirmation. All 30 questions have A–D options and a supplied key.
PDF score is 10 × 2 = 20 marks. Preserve supplied key, fix the broken currency
glyph in Q7 to ₦, and do not send the document to an external AI provider.

Private bank belongs to Wyn City; verified tenant slug wyncity in existing code.
Expose it only through authenticated same-tenant unrestricted-HR endpoints, never
static employee imports. Existing appraisal AI uses Anthropic claude-haiku-4-5;
follow that existing model/SDK convention with bounded draft-only generation.
Do not overwrite questions automatically with generated output.

Date bounds are inclusive tenant days, max 366 days. Legacy month-only definitions
and attempts without personalized question IDs keep their historical behavior.
New assignments freeze 10 random unique IDs and order at launch; marks and date
range are frozen into outputs. Underlying attendance/bonus/equal-weight rules stay.


## Implementation and how to use

Draft peer cycle → enable Examination and attendance → choose inclusive start/end
and departments → Use Wyn City question bank → review 30 questions/keys → Save
examination settings → launch. Employee paper is frozen to 10 unique randomized
questions at launch (2 marks each /20); options keep supplied order. Grade also
shows percentage. Existing equal-weight score/bonus calculation is unchanged.

AI topic/count (10–50) → Generate draft questions → review prompts/options/keys and
model → Use generated questions → edit/save settings. Existing SDK/provider uses
ANTHROPIC_API_KEY, default claude-haiku-4-5, optional EXAMINATION_AI_MODEL.
Only topic/count sent; no PDF or employee data. Timeout45s, no retries, rate cap
5/user/tenant/15min, invalid output502, missing key503. No live model call made.

Backend: attendance-window.js validates tenant calendar ranges1–366days and legacy
month fallback. exam-assignment.js uses crypto shuffle and freezes IDs on attempts.
New schema fields include date bounds/quantity/marks; snapshots freeze dates;
legacy attempts without IDs keep full paper. Source preset is private wyncity HR
only, not a browser import. New bank/generate routes require same-tenant draft HR.
See server/services/peerAppraisal/EXAMINATION.md and data/examinations/README.md.

UI: attendance-range, question-sources (preset/AI review), question-bank-editor
(single expanded accordion), setup hook and marks display. Saving is blocked while
a source request runs; date/dept edits made during generation/loading survive.
AI errors preserve old bank. No live cycle or production HR data was changed.

## Verification

- Full server suite: 4,058 passed,36 skipped,0 failed (/tmp/exam-bank-server.log).
  Final attendance error-copy change rechecked with all16 examination rules/AI/
  personalization tests (/tmp/exam-bank-rules-final.log).
- Appraisal UI:326 tests across26 files passed (/tmp/exam-bank-ui-final.log).
  Includes load/save30,10/20 summary,AI preview/apply,error preservation and
  in-flight bank save/date protection. RED evidence /tmp/exam-source-race-red.log.
- Scoped tsc --noEmit -p tsconfig.appraisals-check.json passed with no diagnostics.
- Real disposable Mongo/JWT/HTTP workflow:8 passed,0 skipped, includes private bank
  permissions,fixed papers,unassigned-question rejection,18/20 grading,date-range
  exclusion,90/93.33 combined scores and45000/46666.67 bonuses. Final rerun log:
  /tmp/exam-bank-http-final.log.
- Source PDF text read fully; rendered pages1 and5 inspected. All30 keys tested.
- No live authenticated browser walkthrough or real paid AI invocation. Reviewed
  responsive component structure and tested actual rendered component interactions.
  No new dependencies,subagents,commit,push or deployment. Self-review;CodeRabbit
  unavailable. Disposable Mongo stopped after the final workflow rerun. Scoped whitespace check passed.

Independent employees may get overlapping questions; randomization does not
promise disjoint papers. Existing launched cycles keep historical settings; use a
new draft cycle for the supplied bank. Apply changes by deploying server/admin
normally; supplied bank still requires HR's explicit load/save in their cycle.


2026-10-19 follow-up: per-question editable marks, AI difficulty/marks, weighted
earned/max scoring and configurable server-enforced exam duration implemented.
Latest handoff supersedes equal-mark/new-exam instructions above:
docs/superpowers/specs/RESUME-weighted-timed-examinations.md.
