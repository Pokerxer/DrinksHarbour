# Occasion planning prompting (guests, budget, event, category/size planning)

2026-10-27. Implemented in server/services/: weddingBeveragePrompt.js (per-
occasion planner briefs), occasionChat.service.js (brief + PLANNING CHECKS
paragraph), occasionList.service.js (occasion passed into generationPrompt),
chatbot.service.js (loadCatalog volume annotations + CATALOGUE STRUCTURE
header). Spec: docs/superpowers/specs/2026-10-27-occasion-planning-prompting-
design.md.

## What exists now

- OCCASION_BRIEFS + occasionBrief(occasion): weddings keeps
  WEDDING_BEVERAGE_BRIEF byte-identical (also the structured path for
  weddings); corporate/house party/gift/bulk/generic have
  distinct profiles sharing the planning discipline (event phases, drinking vs
  non-drinking guests, shared-portion allocation, 98–100% budget utilization,
  explicit assumptions/shortfalls, unquoted service logistics, trust rules).
  Gifting plans packaging/recipient, not guest quotas. Alias map accepts both
  platform slugs (weddings, corporate…) and conversational labels (wedding,
  corporate event…).
- planOccasion: non-wedding system prompts prepend the occasion profile + a
  PLANNING CHECKS paragraph: use the CATALOGUE STRUCTURE header, do size-aware
  arithmetic (wine 150ml, toast 125ml, spirits 25ml measures, soft drinks
  250ml, beer single containers, water litres) with the catalogue's verified
  volume annotations, PRESCRIBE SIZES per serving role, show per-category
  arithmetic before totals, state allocations/remaining budget/assumptions.
- loadCatalog: size lines annotate verified volume "75cl (750ml)" (also used
  verbatim planOccasion stock-stripping note applies); CATALOGUE STRUCTURE
  header lists Category > Subcategory: N products, price band — replaces the
  old flat CATEGORIES line. Shared by shopper chat and occasion chat alike.
- generationPrompt: per-occasion profile for every occasion; weddings body
  byte-identical; non-weddings add PLAN BY CATEGORY AND SIZE (choose sizes per
  serving role; justify in coverageExplanation with per-category coverage
  arithmetic). Deterministic quantity capping/budget upgrade remain
  weddings-only by design (user decision).

## Verification notes

- Server tests: __tests__/occasionPlanningPrompt.test.js (brief identity for
  weddings, per-occasion distinctness, planOccasion system tokens, catalog
  annotations) added; chatbot.catalog.test.js dedupe assertion updated to
  forbid bullet-form duplicate labels while allowing volume annotations.
- Full backend run (2026-10-27, this machine): 4391 tests, 4294 pass, 23 fail,
  74 skipped. All 23 failures are venue/market/booking Mongo suites (booking,
  marketEnrollment, venue*) that require none of the touched modules and fail
  in __tests__/helpers/venueMongo.js bootstrap — the local replica-set URL on
  29127 is empty, so they never reach their assertions. Environmental and
  pre-existing, unrelated to this workstream; do not attribute them to these
  changes.
- Run: cd server && node --test '__tests__/*.test.js'.
- Watchouts: keep WEDDING_BEVERAGE_BRIEF byte-identical; wedding-only capping
  unchanged; generationPrompt callers must pass occasion: input.occasion;
  _catalogCache caches text ~5min so tests use fresh tenant ids.

## User decisions

- Approved via brainstorming Q&A: improve BOTH AI surfaces with per-occasion
  prompting quality, guests/budget/event accuracy and category/subcategory/
  prescribed-size planning; weddings byte-identical; deterministic capping
  stays weddings-only (no new enforcement).
