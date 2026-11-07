---
name: Wyn City attendance score correction
description: All-history attendance repair; Janice historical off-days and missing roster/weekly quota issues.
type: project
---

User requested scores for all recorded attendance on 2026-10-19. See
`docs/superpowers/specs/RESUME-wyncity-attendance-scores.md`. Scores compute on
read. Joshua/Faith/Oluchi were unrated despite actual kiosk punches; no published
historical roster. Janice scored 67 before historical Monday/Tuesday exclusions.
Do not manufacture clock-outs, auto-pass unrostered attendance, or publish
unknown historical shifts to create a score. No bonus/appraisal closure authorized.

User then confirmed Joshua started Shift1 on Oct7 and Faith/Oluchi require four
attended weekdays per completed week. Live roster/punch-link corrections applied
with audits; final all-history calculations: Joshua72, Janice79 (67 before),
Faith85, Oluchi89. Faith/Oluchi policy coverage starts first recorded week Aug17;
completed weeks through Oct16 only. Policy persisted on employee planning;
new weekly evaluator/API/UI changes remain LOCAL, UNCOMMITTED, NOT DEPLOYED.
Their production dashboard remains unrated until deployment. Joshua and Janice
use existing published-shift scoring, so their live data corrections take effect.
No punch times/sources/statuses/worked minutes changed. Anomalous long records
and Joshua's 2-minute Oct18 record need manager review. Report at
`docs/reports/wyncity-attendance-scores-2026-10-19.md`; audits and tests in RESUME.
