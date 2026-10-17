---
name: Nearest-seller marketplace ordering
description: Delivery-address-first marketplace proximity ordering, representative seller prices and verification handoff.
type: project
---

Implemented on 2026-10-12 after behavior, specification and implementation-plan
approval. Start with the default saved delivery address; an explicitly applied
delivery/current-location choice takes priority. Keep one central Product listing,
rank by qualifying Tenant/SubProduct distance before pagination, retain farther
and unknown-distance sellers, and use representative SubProduct/Size IDs for
price/default/cart consistency. Explicit customer sorts and seller choices win;
existing cart lines do not change on location refresh.

x-shopping-location carries numeric lat/lon JSON privately in headers. Responses
vary on it; personalized results bypass shared caches. Account, address,
geolocation and result requests discard stale completions. The initial API
prices all matching candidates and needs latency monitoring. No schema change,
new dependency, commit, push or deployment was made.

Read [the handoff](../superpowers/specs/RESUME-nearest-seller-marketplace.md) and
[execution ledger](../superpowers/specs/PROGRESS-nearest-seller-marketplace.md)
for exact tests, browser limitations and rollout order. Business-address
geographic distance is approximate; fulfilment locations/road ETA remain outside
this feature. Existing platform type errors are unrelated to this change.

Verification after the refinement: platform suite 100 passed; commerce-core 51
passed and its earlier type check passed. Full backend suite 3711 passed,
0 failed, 5 skipped, including the qualifying-stock correction. A separate
local Mongo fixture validated 704 candidates, exact pagination, seller/price
identity and Tenant scoping; one final run took 3238 ms for 24 returned cards.
Platform type checking retains 19 existing diagnostics outside feature files.
Initial browser rendering was checked; the age gate limited interaction.
The refinement preview was blocked by the browser's local-file URL policy;
visual inspection of the refined layout remains unverified. Its actual
components rendered to HTML and the Tailwind stylesheet compiled successfully.

Superpowers handoff/plan files are locally present but Git-ignored by existing
repository rules. This unignored memory file and the platform/server README
updates preserve the implementation contract and evidence when changes are
eventually staged. Temporary verification services were stopped; no deployment
was made.

## Approved improvement pass (implemented 2026-10-12)

### Current-location timeout follow-up (completed locally)

Reported timeout traces to current-location.ts: one browser lookup with a 10s
timeout; manual Retry repeated the same options. Updated the helper and tests:
first allow a recent coarse fix (10s), then on timeout try a fresh accurate
fix (20s). Maximum two attempts; permission denial stops immediately, and
abort/late callbacks never start another request or commit a location.
Final timeout advice includes checking device location services and entering
a delivery address. Browser/device availability remains external; no substitute
coordinates. Reproduced the missing recovery with failing tests before edits.
Full platform suite: 109 passed; focused helper: 7 passed. Type check retains
19 baseline diagnostics, none in the location helper. Logs:
/tmp/drinksharbour-location-timeout-{tests,types}.log. No live device geolocation
verification or deployment; no backend changes or new dependencies.

The user requested improved functionality and design after implementation. Focus
this bounded pass on the existing location picker, nearby-result feedback and
seller presentation. Implemented: compact header location control; mobile
bottom sheet/desktop dialog; draft address/current-location selection with an
explicit Apply location action; Cancel preserves the active location; inline
retry and distinct saved-address/geolocation states; clearer nearest-sort/update
status; consistent seller/distance treatments on cards and details. Current
location should be selectable without first deleting the active delivery choice,
but it becomes active only after explicit confirmation. Preserve existing cart
identities, public eligibility and complete-catalogue ranking.

Visual direction: existing brand red #b20202, ink #18181b, white #ffffff, mist
#f4f4f5, border #e4e4e7, success #166534. Retain existing storefront fonts, use
strong address labels with quieter source/distance captions and restrained map
pin/check icons. Use a persistent mobile Apply footer, keyboard focus and reduced
motion. Extend current ShoppingLocation components/context and SellerDistance;
draft/geolocation helpers are colocated with those files. No new architecture
or dependency was needed. The user approved this brief before implementation.

New helpers: useLocationDraft.ts, current-location.ts, seller-proximity.ts,
SellerProximity.tsx and NearbyResultsStatus.tsx. Provider/dialog lifecycle tests
cover preview versus commit, partial-address blocking, Cancel, explicitly applied
current location and saved-address retry. Geolocation tests cover aborted late
callbacks, zero/invalid coordinates and permission feedback; distance tests cover
unknown and short distances. Each new behavior had a failing test before its
implementation. Self-review followed the one-agent rule; CodeRabbit is unavailable.
No commit, push or deployment was made. Latest verification logs are in /tmp/
drinksharbour-proximity-refinement-{platform-final,server,commerce,types-final}.log.

## Mobile header placement — 2026-10-12

User explicitly requested location beside the mobile search bar with a prominent
location icon. Use an accessible 44px brand-red pin button on the right of search,
opening the existing picker; retain the full address row on desktop. Reuse the
control with a compact prop, and keep the search shrinkable on narrow screens.
Implemented: filled red pin on a pale-red circular button immediately after the
search bar below lg; desktop retains the full location row. Accessible label
includes the active address and the same dialog handles changes. Existing picker
lifecycle test and diff whitespace passed. No visual browser verification or
deployment. Type-check log: /tmp/drinksharbour-mobile-location-types.log.

## Shop strip removed — 2026-10-12

User screenshots identified the address/“Nearest available sellers first” strip
between the shop hero and filters as unwanted. Removed its ShopClient render and
import. Location selection in the header, nearest ordering, sort dropdown and
seller-distance metadata remain. Search-specific status is unchanged. This is a
presentation-only removal, with no backend/query changes or deployment.
