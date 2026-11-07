---
name: Review modal selling-price markup
description: Live percentage preview, inherited reset, fixed retail payout and validation in product review
type: project
---

Updated2026-11-02 for `/products/[slug]/edit` → Review Sub-Product. Backend contract
is unchanged: submit website price or explicit inherited-reset flag; server stores
and validates the effective percentage from fresh tenant retail. Never send a
client-computed percentage as settlement authority.

`review/selling-markup.ts` owns typed model/default selection, kobo retail rounding
and discount-inverted/four-decimal percentage preview. `SellingMarkupSummary.tsx`
shows live percentage/default/source and pending reset. `review-lines.ts` maps
server rows into review rows/initial drafts; pricing.ts preserves public exports.

For selling-price markup, tenant payout is retail, not supplier cost. Suggestions
can work without supplier cost; profit stays unknown in that case. Catalogue
sales are inverted for stored percentage; listing sales affect customer proceeds.
An unchanged rounded quote retains the saved percentage. Explicit zero is valid.
Missing default data stays Unavailable, and cannot enable reset. Resets save only
on approval; subsequent manual price edits cancel reset. Separate pack pricing is
unsupported, including stale pack drafts/metadata. Above-retail warning remains
only for legacy models; this premium is intentional. Targets are margins, not the
markup percentage, and never rewrite Tenant terms. Overview labels the tenant
default rather than mistaking a saved product override for that default.

Verification: full admin3450 pass; final focused review54 pass; types/scoped lint
and whitespace pass. Backend pricing42 pass/1skip. Full server61 unrelated
fixture/date failures are itemized in docs/audits/review-modal-server-baseline-2026-11-02.md.
No backend changes, production writes, deployment, commit or authenticated browser
check. See docs/superpowers/specs/RESUME-review-selling-markup-modal.md for evidence.
