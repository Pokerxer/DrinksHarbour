# Occasion pages, planning tools and subpages

2026-10-27 (evening pass): UI/UX polish landed — OccasionShelf query fix
(query || category || label; never a human label as search text), labelled
loading skeletons, error state with Try-again button; CommercialGuide gained a
full-width `below` slot + facts chip strip + section anchors with an
On-this-page strip for subpages; per-occasion Planning split into Story/Below
named exports (default export still composes both for tests); [occasion] page
order is now hero → SubpageNav → story grid → tools band → request form;
WeddingPlanner moved the calculator/shelf band full-width under the planner
grid; all 8 subpages declare honest `facts` chips (lib/occasions/*).
Verified: platform tsc clean; 39/39 occasion/wedding component suites;
Playwright shots show shelves resolving (6 champagne bottles on weddings/
gifting, 4 whisky/wine on corporate), chips + anchors on subpages; spec:
docs/superpowers/specs/2026-10-27-occasion-ui-ux-polish-design.md. Known
site-wide artifacts NOT from this work: AdSense interstitial dimming the top,
flapping backend on :5001.

2026-10-27. Implemented locally by one main agent + four parallel occasion
agents (weddings, corporate, house-parties, gifting) on disjoint file sets.
No commit, push or deployment; unrelated dirty checkout preserved. Spec:
docs/superpowers/specs/2026-10-27-occasion-pages-subpages-design.md; plan with
agent contract: docs/superpowers/plans/2026-10-27-occasion-pages-plan.md.

## What exists now

- Shared layer (main agent): lib/occasions/{types,index,weddings,corporate,
  house-parties,gifting}.ts — SubpageDoc registry + subpageToPage mapping to
  CommercialGuide. app/occasions/[occasion]/[subpage]/page.tsx renders static
  subpages (generateStaticParams, notFound otherwise, guideMetadata).
- CommercialGuide gained an optional `body` prop replacing generic sections.
- app/occasions/[occasion]/page.tsx mounts XxxPlanning per slug as body above
  SubpageNav + OccasionChatPlanner; weddings dispatches <WeddingPage/> as
  before (nav + calculator/shelf live inside Weddings/).
- Planning primitives: components/Occasions/planning/GuestDrinkCalculator
  (deterministic guests×hours×share→bottles, roundTo case rounding),
  OccasionShelf (/api/products/search, publicBottleChoices, /product/slug
  links, optional onAdd), SubpageNav.
- Per occasion: Weddings (WeddingQuantities + planning.ts CalcConfig),
  Occasions/corporate (CorporatePlanning(+Tools, calcConfig, sections,
  SuggestionQuantities)), house-parties (HousePartiesPlanning, HousePartyTools,
  config, cocktailPlan, CocktailPlanner), gifting (GiftingPlanning, GiftFinder,
  giftFinderTable, GiftChecklist).

## Invariants

- NO customer-facing AI on occasion pages (2026-10-21 decision holds);
  OccasionChatPlanner remains the staff-review intake. Floating shopping AI
  stays hidden under all /occasions routes (prefix matcher includes subpages).
- Planning tools output quantities only; no client-side price math; bottles
  reach the request list as name+quantity via lib/weddingBottleList. Corporate
  and house-parties tools display an honest local aria-live quantity summary
  for the customer to transcribe into the request form (no shared list state
  yet; seam = each folder's add()/tools component if context is added later).
- Honest commerce copy everywhere: no stock reservation, no guaranteed dates,
  18+ for alcohol, packaging/invoice needs explicit confirmation.
- Agent file ownership mirrors folder unions (Weddings/** vs
  Occasions/<occasion>/** + own lib/occasions/<occasion>.ts). Shared files are
  main-agent only.

## Cold resume

- Selection-driven calculators (same day): checked planner categories
  (toast/wine/beer/spirits/alcohol-free) filter the calculator rows via
  lib/occasions/categoryRows.ts (CATEGORY_TO_ROWS per occasion,
  rowsForSelection, uncoveredSelection). Weddings config carries beer+spirits
  rows; house-parties has no champagne row (uncovered selections render an
  honest note). Weddings: direct selected prop through WeddingQuantities;
  corporate/house-parties: OccasionDrinksProvider wraps the below slot and
  OccasionChatPlanner consumes the optional context (uncontrolled elsewhere).
  Verified: tsc clean; 41/41 suites; Playwright row behavior on both paths.
- Gifting functions + animations (same day evening): four tools behind
  GiftingToolkit tabs (hamper / recipients / budget / message; one panel
  mounted, one shared SuggestionQuantities in the toolkit — Hoisted OUT of
  HamperBuilder which is onUse-driven). Logic modules: recipientPlan.ts,
  giftBudgetLadder.ts (LADDER lib — casing gotcha), giftMessages.ts;
  animations in giftAnimations.module.css (reduced-motion off-switch); tests
  extended in gifting.test.cjs (10 tests) + CSS-module stubs in gifting and
  weddings loaders; 46/46 occasion+wedding suite tests; Playwright: 4 tabs,
  1 panel, 1 summary persisting across tab switches, no page errors, page
  ~6.5k px tall (was ~9k). Spec: docs/superpowers/specs/2026-10-27-gifting-
  functions-design.md.
- Typecheck: `./node_modules/.bin/tsc --noEmit` in client/apps/platform.
- Tests: node --test 'src/components/Occasions/**/*.test.cjs' plus
  Weddings/weddings-plan.test.cjs and Weddings/weddings.test.cjs (28 pass at
  handoff). Verified on dev server 3002: occasion + subpage routes 200 with
  correct metadata; unknown occasion/subpage 404.
- macOS case-insensitivity gotcha: gifting lib is giftFinderTable.ts so the
  GiftFinder component import cannot collide — keep this naming when adding
  libs beside same-named .tsx components.
- Subpage topics: weddings champagne, traditional-engagement; corporate
  client-gifts, end-of-year-events; house-parties cocktails, birthday;
  gifting hampers, corporate-gifts. Extend by adding complete SubpageDoc
  entries to the occasion's lib file — routing/metadata/nav pick them up
  automatically.
- Later ideas (not requested): explorer card links to subpages; wedding-style
  channel so Planning tools add straight into the request bottle list; tune
  CalcConfig serving assumptions.
