---
name: Category-driven occasion generation
type: project
date: 2026-10-21
---

User removed custom bottle entry and size/pack details. Visible category cards now
precede catalogue search on weddings/shared occasion planners. Select preferences,
enter budget and guest count, choose Generate my drinks list; existing chat opens
with a catalogue shortlist and supports conversation. Catalogue images/quantity,
direct chat/upload and enquiry remain.

Server validates generation JSON and actual public priced/stocked catalogue
offers. Claude Haiku4.5 returns schema-constrained IDs/quantities; server enforces
category/stock/budget and calculates totals in kobo. Provider prose/prices are
never displayed as offers. No cart/order mutation or guest-to-alcohol ratios.

229 storefront tests and4116 backend tests pass (36skipped), types/lint pass.
Real browser/provider test:40guests,150000budget,wine+nonalcoholic ->122700subtotal,
27300remaining. Mobile verified. Local only, no deploy.
Resume: docs/superpowers/specs/RESUME-category-generated-list.md.

Latest follow-up: occasion-search-ai-improvements.md and corresponding RESUME.
Selected catalogue quantities now reserve budget first; AI cards apply proposed
quantities, and search/history/tenant cancellation have functional improvements.
