# Promotion suggestions request

Proposed feature: /notifications/promotions, separate from product approval
updates. Learn basket affinity from tenant customer sales, exclude transfers,
deduplicate POS/linked sales, net returns, guard stock and margins. Show measured
confidence and holiday/custom-day timing, with local model name; no guaranteed
uplift or external AI provider implied. Suggestion previews do not activate prices.

Design and approval state:
docs/superpowers/specs/2026-10-10-promotion-suggestions-design.md and
docs/superpowers/specs/RESUME-promotion-suggestions.md.
User approved; implementation is now present. Local basket identity opt-in feeds
association rules, protected warehouse stock and margin-safe preview pricing.
API and route are in the resume file. Financial settings and special-day entries
are transient; no live promotion activation or saved campaign occurs. Default
ceiling 10%, gross-margin floor 20%, editable within validated limits. Unknown or
zero cost and overlapping discounts require manual review. Staff pricing is
redacted. See resume for verification and exact evidence thresholds.

Verified after final basket-alias fix: backend 3,637 passed / five skipped; admin
2,660 passed in 295 files. Scoped types, feature lint, formatting, syntax and
whitespace checks passed. Browser visual verification was not performed.

Continued accuracy corrections: whole-unit spare stock required; opportunity
ranking before the 500-result cap; promotion conflict matching uses actual
catalogue category/brand with exact sizes/exclusions (unknown taxonomy reviewed).
Special days are bounded to Lagos today through day 60 in the browser as well as
server; reset cannot race a loading request. Verification is in the resume file.

Continued review verified: backend 3,643 passed / five skipped / zero failures;
admin 2,662 passed in 296 files. Types, lint, formatting and syntax passed.
Browser visual verification was not performed.

Special-day calendar: shared DatePicker with button trigger, month navigation,
disabled past/day-61+ choices, loading guards and paired Clear special day. Use
local calendar fields for selected ISO dates to prevent UTC shifts (verified at
UTC+14); Lagos still determines allowed dates. Apply commits the draft to the
read-only suggestion query, including clearing. See resume for full checks.

Calendar verification: backend 3,647 passed / five skipped; dashboard 2,666
passed in 297 files. Types/lint/format/whitespace passed. Browser tool unavailable.

World drinks events: source/rules record server/services/promotionSuggestions/drink-events.md.
Seven curated event rules feed the next-60-day calendar and typed Product relevance.
Single-year Champagne 2026 date is not extrapolated. UI selector fills name/date;
exact catalogue selections preserve source/family; date/name edits become custom.
No source scraping, assumed seasonal uplift or live offer activation. See resume.

World events verification: backend 3,653 passed / five skipped; admin 2,668
passed in 298 files. Scoped types/lint/format/syntax/whitespace passed.
