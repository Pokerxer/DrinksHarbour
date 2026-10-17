# Sub-Product review rules

Full viewport Headless UI dialog; keep header/actions fixed and main content
scrolling. Preserve existing admin typography and neutral surfaces/blue actions.
New files stay focused, under 300 lines.

Payout comes from server platformCostPrice. Profit is gross, excluding operational
costs/tax/fees; never label it net profit. Markup and margin are different ratios.
Existing effective markup and per-price tenant margin seed targets. Targets and
suggestions are local proposals until approval; never rewrite supplier costs or
Tenant revenue agreements to make a proposal appear viable.

Listing-sale price input is before that sale; catalogue discount is already
included. Show final customer economics. Pack offers require real savings and
must not stack with a sale. Unknown cost/payout stays unknown. NGN only for overrides.

Reads must cancel/discard stale listing or token results. Failed writes keep the
modal open; only successful writes close it. Parent errors must propagate to the
modal; direct row shortcuts separately catch their rejected promises.

Canonical formulas/operating notes: docs/memory/subproduct-review-pricing.md at
repository root. Server validates fresh prices and tenant/size ownership.

Workspace filters never limit validation or approval scope: all prices still apply.
Bulk suggestions must preserve manual edits and skip rows needing pack or target
review. Reset restores server-loaded values; blank pack drafts retain the current
rule. Comparison deltas refer to editable settings, not unadjusted customer prices.
Do not add per-size gross-profit amounts into a fake listing-wide total.
See docs/memory/subproduct-review-workspace.md at repository root.

Close/reload must guard dirty price drafts and active unsent decline feedback.
Keep editing/Escape cancel discard; confirmed reload replaces drafts from fresh
server data. Successful writes close directly without prompting; pending writes
block dismissal. Browser beforeunload protection is cleaned up when clean/unmounted.
No review drafts in browser storage. See docs/memory/subproduct-review-edit-protection.md.

Revenue agreement correction (2026-10-17): commission uses final merchandise and
locks the agreed rate. Price edits change commission payout; no second markup.
Only markup agreements preserve a fixed payout. Explicit commission overrides are
stored separately from markup percentages. See docs/memory/revenue-agreement-pricing.md.
