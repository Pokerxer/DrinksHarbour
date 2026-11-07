# Printable cycle results PDF

2026-10-21: closed peer cycle header now offers Download results PDF. Fetches
fresh authorized final snapshots, generates landscapeA4 PDF locally with all
employee component scores,total,allocations,bonuses,dates and saved weights.
Open downloaded file to print. Incomplete/open results cannot be exported.
No attendance recalculation, data mutation, payment or third-party transmission.

Files `cycle-results-pdf.ts`, `cycle-results-export.tsx` beside appraisal UI;
integration peer-rating/cycle-panel. No new dependencies. Full UI360passed,
final focused5passed,types clean; actual browser PDF download and6page sample
render/text verified. Local/uncommitted, not deployed.
Handoff: `docs/superpowers/specs/RESUME-cycle-results-pdf.md`.
