---
name: Product detail improvements
description: Product detail review findings and proposed bounded purchase-flow refinement.
type: project
---

## Request — 2026-10-12

User requested improvements to /products/[slug]. Actual existing storefront route
is /product/[slug]; treat this as the existing detail page, without adding a new
route unless needed/requested. Relevant files: app/product/[slug]/ProductClient,
components/Product/Detail/index, existing SizeSelector/QuantitySelector and seller
components. Preserve central Product/SubProduct identities, nearest defaults,
explicit seller choices and existing cart lines.

Read-only finding: detail quantity controls use maxOrderQuantity || stock || 99,
so an explicit maximum can exceed actual stock; size-change clamps can also force
the minimum above available stock. Add-to-cart checks inStock but does not itself
check the proposed quantity against both limits.

User approved bounded refinement: constrain quantity
and pack selection to stock and seller min/max; explain unavailable choices;
clearer seller/distance/size/current price presentation; accessible mobile purchase
controls; explicit refresh/loading/error/retry feedback preserving seller choice.
Extract changed sections/helpers from the large detail component, reuse existing
primitives, regression-test seller/size transitions and purchase quantities.
Implemented locally. Live stock is still server-authoritative.

## Behavior and file structure

New purchase-quantity helper caps maximum to the smaller of available stock and
seller maximum. Missing/nonfinite/zero stock, sold-out flags and insufficient
stock for the minimum cannot be ordered. Zero availableStock overrides physical
stock. Quantity and pack quick-selection clamp across size/seller changes; cart
handler checks bounds and refresh state. Representative SubProduct/Size IDs seed
the correct default; explicit seller/size choices remain selected through refresh.

PurchaseControls provides a mobile sticky/desktop inline quantity-and-total panel,
accessible buttons, seller/size summary and minimum/unavailability guidance.
SellerChoices and SizeChoices show clear selection, logo/distance/nearest badges,
size price/order caps/volume and qualifying sale/pack information. These sections
and shared detail-types were extracted from the large parent component. Existing
gallery, description, reviews, wishlist, compare and WhatsApp enquiry paths stay
in place; this pass does not rewrite those sections.

ProductClient uses the initial SSR payload only on the first coordinate-free
load. Changing/clearing location or Retry fetches fresh prices/stock. Abort and
request guards cover both product and related-product completions. Background
loading/failure retains the mounted detail and explicit seller state; purchase
controls pause until refresh succeeds. Product-ID keys reset detail state for a
different drink. Initial and background failures offer Retry without full reload.

## Verification

Quantity tests failed on the old maximum/stock and 99 fallback behavior before
the fix. Refresh lifecycle test failed on missing Retry before edits. Actual
detail component tests exercise cart SubProduct/Size/quantity identity, stock caps,
size clamping, unavailable minimum, representative default, seller refresh/reorder
and blocked purchase. Full platform suite: 118 passed. Commerce-core: 51 passed.
Type checking retains 19 baseline diagnostics outside changed detail files.
Diff whitespace check passed. Logs: /tmp/drinksharbour-detail-{tests-final,
types-final,commerce}.log. Self-review under one-agent rule. Visual browser/live
API smoke testing remains unverified; tests use jsdom and boundary mocks.

No schema/backend change, dependency installation, commit, push or deployment.
Actual route remains /product/[slug]. Preserve unrelated working-tree changes.
