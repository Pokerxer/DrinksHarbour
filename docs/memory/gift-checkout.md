# Gift checkout (order-level gifting)

2026-11-14. [Gifting service proposal](gifting-service.md) records the Abuja storefront offer and fulfillment checks before launch.

2026-10-28. Implemented by three parallel agents (server / client / admin) on
disjoint file sets plus main-agent integration. Spec/contract:
docs/superpowers/specs/2026-10-27-gift-checkout-design.md (+ server report
2026-10-27-gift-checkout-server-report.md). No commits; unrelated dirty files
preserved.

## What exists now

- Order-level `order.gift` subdoc: { isGift, from ≤80, to ≤80, message ≤500,
  requestedDeliveryDate 'YYYY-MM-DD' (≥tomorrow, ≤+180d, Africa/Lagos),
  packagingRequested }. Order.items and models/Cart.js untouched.
- Checkout "Send as a gift?" section (client/apps/platform):
  components/Checkout/CheckoutGiftSection.tsx + lib/giftCheckout.ts (pure
  validation/payload/bounds). Gift rides on createOrderAfterPayment, COD
  submit, and the Korapay pendingPayment stash → payment/verify passes it
  into order creation.
- Packaging = PAID SKU: server/config/giftPackaging.js resolves Product
  {isGiftPackaging:true} → SubProduct/size (5-min cache); server cross-check
  422s when packagingRequested but the SKU line is missing or the SKU is not
  configured. scripts/seed-gift-packaging.js creates the SKU (default ₦5,000,
  env GIFT_PACKAGING_PRICE_NAIRA / GIFT_PACKAGING_TENANT_ID) as pending —
  super-admin must approve+publish. Client adds the SKU as a NORMAL cart line
  and detects it via public search results (`isGiftPackaging` field — surfaced
  in product.service.improved.js search response; that allow-list fix was the
  main-agent integration change).
- Admin: order-view Gift panel (from/to/message/date/packaging, read-only,
  "requested — confirm the exact window" copy) + order-list amber Gift badge
  + compact requested-date line, gift orders only. shared/ecommerce/order/
  gift.ts + gift-panel.tsx + tests.
- Emails/SMS/WhatsApp: customer confirmation renders escaped gift section;
  tenant alerts header "GIFT ORDER — requested delivery <date>". Non-gift
  messages byte-identical (proven by tests).

## Known caveats (do not regress)

- **Packaging SKU discovery (2026-10-28, complete):** public search supports
  `?isGiftPackaging=true|false` (filters in product.service.js searchProducts —
  the LIVE service; the `improved` variant is unused but its latent `Product
  is not defined` require-bug was fixed too), and the flag is surfaced in both
  the full product shape and the `fields=card` projection (CARD_TOP_LEVEL).
- Local dev DB seeded (Product 6ae18cc9… 'Gift packaging', approved+published
  locally by hand as the super-admin step; tenant Wyn City, ₦5,000); live
  HTTP check: `?isGiftPackaging=true` returns the SKU, client-shaped query
  works, `=false` leaks nothing.
- **server/node_modules drift:** `node-cache` (declared dep) had gone missing —
  restored via `npm install node-cache`. If search suddenly 500s with
  "Cannot find module", re-run npm install in server/.
- middleware/validation.middleware.js `validate` is a passthrough repo-wide;
  order.routes.js adds `enforceGiftValidation` gating ONLY gift-path errors.
  Flipping the global gate is a platform-owner decision (flagged follow-up).
- controllers' `orderAccess.project` strips gift for tenant views; the
  controller re-attaches it to the tenant-scoped projection.
- Admin shared Order type (services/order.service.ts) has no `gift` field yet
  (other-session dirty file); admin reads it via a narrow typed cross in
  order-view/gift.ts — simplify when the shared type gains `gift`.
- Deployment: run the seed, super-admin approves/publishes the packaging
  product; else checkout shows "Gift packaging is not available yet."

## Verification at handoff

- Server: 21 giftCheckout tests pass (+neighbors 34/34); full backend run
  4255 pass / 3 pre-existing non-gift failures (venue/booking/mongo harness).
- Platform: giftCheckout.test.cjs 13/13; tsc clean.
- Admin: 37/37 vitest order tests (5 new); typecheck clean except pre-existing
  carrier-panel.test.tsx TS2351 from concurrent other-session work.
- Search suites after the allow-list fix: 22/22 (searchOutOfStock, chatbot
  catalog, catalogue smart/proximity/brand/auth).

## 2026-11-14 recipient contact

The storefront sends a validated optional API field `gift.recipientPhone`. The
updated checkout requires it when gift mode is on. Older gift orders and API
clients can omit it. The platform gift panel and merchant handover use it for
delivery. Buyer notifications continue to use the buyer’s shipping contact
snapshot. See [gifting service](gifting-service.md) for the storefront entry
points and production checks.
