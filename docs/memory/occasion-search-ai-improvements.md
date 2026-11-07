---
name: Occasion search and AI improvements
type: project
date: 2026-10-21
---

Search now uses existing public text/card path, component-local30second cache,
12second deadline/retry, late-blur safety and keyboard option scrolling. Tenant
changes clear search cache; chat session remounts by tenant/occasion and cancels
work plus resets draft/files/history. No browser persistence or cart writes.

Chat history no longer clips each turn at700 chars. Current context/upload and
opening+recent turns share20turn/24k caps; long turns retain head/tail explicitly.
AI product cards show public images; verified generated quantities bind only to
matching catalogue IDs and Add N applies N to planning list with9999 bound.

Live test found cheapest-category candidates dropped a manually chosen bottle.
Generation now sends selections: server reserves those public IDs/quantities first,
discloses budget/stock reductions/unavailable selections, then fills categories.
Up to20 total lines. Existing Claude Haiku4.5 JSON-schema provider integration.
Ordinary conversational replies remain advice; generatedList totals are computed
by server. Never treat free-form model prices/quantities as executable orders.

236 storefront tests/types/lint and4118 backend tests pass,36skip. One unrelated
transient POS HTTP test passed isolated and on final full rerun. Live5-match search,
selected bottle retention,20-unit Add and changed30guest/120000budget follow-up
verified. Mobile checked. Local only, no deployment.
Handoff: docs/superpowers/specs/RESUME-occasion-search-ai-improvements.md.

Follow-up:occasion-empty-plan-fix.md fixes misleading zero-value generated plans.
