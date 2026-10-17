# Sub-Product review workspace refinement

2026-10-17. User requested continued improvements to the full-viewport review.
Builds on `subproduct-review-pricing.md`; no pricing policy or backend writes changed.

## Delivered

- Compact price-review controls count all rows, edits and blocking issues; no
  misleading sum of unrelated per-unit profits.
- Size/SKU search with All prices / Edited / Needs attention / Blocked filters.
  Margin shortfalls include pack-only issues; unchanged packs suspended by a sale
  do not become false approval blockers.
- Bulk normal-price suggestions operate across all sizes, skip any manually edited
  row (including invalid text/fractional entries), and skip rows needing separate
  pack review or missing target margins. They change drafts only.
- Per-price reset and Reset edits restore the current server-loaded normal/pack
  values. Blank pack inputs mean keep the current setting, not remove a pack rule.
- Edited cards show current → proposed website/pack setting, absolute and percentage
  difference, edited badge and reset. Sale-adjusted customer economics remain in
  the existing outcome section; comparison prices refer to the editable settings.
- Footer explains the first blocking error and full issue count on every tab.
  Show issues clears the search, selects Pricing/Blocked and scrolls the content
  to the top. Hidden rows still participate in approval validation.
- Margin targets use a native accessible disclosure, retaining accepted existing
  defaults. Gross-estimate exclusions remain visible outside the disclosure.
- Large screens can show two price cards per row; listing overview stays beside
  the worksheet. Footer has bounded height/scroll for smaller host spaces.

## Files

`review/workspace.ts` owns pure diagnostics/filter/batch logic. `ReviewWorkspace`
provides the worksheet, `ReviewFooter` provides actions/errors, `PriceComparison`
provides deltas. The data hook's batch/reset setters remain keyed to the current
record/token/attempt. New components remain below 300 lines.

## Checks

68 focused tests pass across the product review, header, on-hand stock, Sold
history and pack helpers. Scoped lint and whitespace checks pass. Full backend
suite: 3,954 passed, 16 skipped, zero failures. Project type check retains 359
existing diagnostics; none in review files. Detailed logs are recorded in
`docs/superpowers/specs/RESUME-subproduct-review-workspace.md`.
Live protected UI was not visually reverified; the last browser session required
admin sign-in and no authentication bypass was used.

Follow-up: `subproduct-review-edit-protection.md` records the product-led header,
guarded close/reload, keyboard behavior and browser-refresh protection.
