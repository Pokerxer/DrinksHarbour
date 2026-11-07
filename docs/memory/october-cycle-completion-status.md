# October cycle completion status — 2026-10-20

Read-only live check at 22:41 UTC / 23:41 Lagos: Wyn City October cycle still
`collecting`; all8 selected appraisers submitted and all14 currently assigned
exam recipients submitted.29 appraisal participants;0 released result snapshots.
Attendance window20September–20October inclusive, so its end is local midnight
starting21October; overnight shifts starting in the range must also complete.
No cycle closure or data mutation requested/performed. Completion counts are
a dated snapshot; query fresh before reporting again. Do not conflate all
submissions completed with formal cycle closure/results release.

User then requested ending the cycle to see totals. Readiness audit at23:44 Lagos
found one published shift still ends21October09:00 Lagos, and Somto has16 punches
but zero published roster rows, making attendance null.28 of29 have currently
rated attendance. Asked user which shift/effective date applies to Somto; pending.
Did not shorten attendance bounds, fabricate shifts or force closure.

Calculated/opened a private provisional component/total report for28 employees:
`/tmp/october-appraisal-provisional-scores.md` (23:46 Lagos snapshot). Somto is
pending. Uses existing40/40/20 and80/20 formula; completed shifts only, no bonus
release/data writes. Can finalize only after resolving actual closure blockers
or an explicit change to the attendance policy/window. Never treat provisional
report as released financial results. Regina exclusion/Goodness preservation
remain unchanged. No automated future closure scheduled.

Later user confirmed Somto Shift2 from20September; correction applied and verified.
See `somto-shift2-attendance.md`. All29 employees now have attendance/provisional
totals; no missing scores. Two published shifts (now including Somto) finish
21October09:00 Lagos. Report refreshed23:50 Lagos; Somto combined77.80%. Still
collecting; no forced closure or attendance date changes.

At23:52 Lagos user reported inability to close/calculate. Fresh read confirms
same state: period not ended,two included shifts end21October09:00,no unrated.
Asked whether to close now using only completed shifts (freezes bonuses without
unfinished shifts) or wait/include both. This is a scoring-cutoff choice, not
permission to change clock times. No answer yet; do not bypass completion guards
or change the attendance window without it. Existing production API does not
support a completed-shifts-only close option; implementing that requires an
explicit, audited cutoff with snapshots and tests after user selects it.

User selected **Close now using completed shifts only**. Prepared one-off closure
and completed fully validated preview:29results,307completed shifts,2excluded.
However all29 saved allocations are₦0 and all bonuses would freeze at₦0.
Asked user for allocations or explicit choice to close with zero bonuses.
NO CLOSURE APPLIED yet. Detail/script/cutoff/digest in
`docs/superpowers/specs/RESUME-october-completed-shifts-closure.md`.

FINAL UPDATE: User then explicitly chose **Close with zero bonuses**. October
is now CLOSED, closedAt22:58:29UTC /23:58:29Lagos20October.29 final score snapshots
released; total bonus₦0.307completed shifts included at pinned23:55:50Lagos cutoff,
two unfinished excluded. Exactly one audit; independent post-commit read verified
all29 snapshots and ownResult access. Final report
`/tmp/october-appraisal-final-scores.md`. This supersedes all earlier collecting/
pending statements above. Never re-run closure or rewrite released scores.
