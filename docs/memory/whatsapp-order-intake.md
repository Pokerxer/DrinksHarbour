# WhatsApp Order Intake module

Date: 2026-11-14
Spec: `docs/superpowers/specs/2026-11-14-whatsapp-order-intake-design.md`
Plan: `docs/superpowers/plans/2026-11-14-whatsapp-order-intake.md`

## What it does

Platform admins (super_admin/admin) transcribe orders taken over WhatsApp:
pick items from any tenant's SubProducts + size variants in a builder UI,
create the order through the normal checkout pipeline, and issue the customer
a token-gated hosted invoice with a Kora Pay payment link. Tenants fulfill the
resulting orders through the existing merchant-orders queue — no new
fulfillment surface was built.

## Key contracts

- **Manual mode on `POST /api/orders`** (`server/controllers/order.controller.js`):
  body `manualOrder: { originChannel: 'whatsapp' }`, actor must be a platform
  admin (`!req.user.tenant`, role super_admin/admin). `order.user` = customer
  matched by email then phone, else guest — NEVER the admin. Order is created
  UNPAID (`paymentStatus: 'pending'`, `paymentMethod: 'bank_transfer'`,
  `source: 'manual'`, `placedBy: admin`). Coupons rejected in manual mode.
  Customer-confirmation emails/SMS/WhatsApp are suppressed at creation; tenant
  new-order alerts + socket event fire immediately.
- **New Order fields**: `originChannel` (enum ['whatsapp'], default null,
  indexed), `placedBy`, `invoice` subdoc `{ token, issuedAt, issuedBy,
  provider, paymentReference, attempt }`. Declared as a Mongoose subdoc schema
  with `default: undefined` (Mongoose 9 auto-instantiates bare nested objects —
  a bare nested path would materialize on every order).
- **Invoice service** (`server/services/whatsappOrderInvoice.js`):
  `issueInvoice` mints a 48-hex token, initializes a gateway charge via
  `marketplacePaymentTrust.initialize(..., extraMetadata)` with
  `orderId` metadata AND a `callbackUrl` pointing back at the invoice page
  (forwarded into the gateway charge options), binds the claim to the order
  (`claim.order`), and extends the claim TTL to 30 days (trust default is 24h —
  invoices sit unpaid longer than one checkout session). Idempotent re-send
  while the charge is live; `force` mints a fresh attempt (`dhwo-<orderId>-v<n>`).
- **Settlement is fail-closed on the claim binding**: `settleWithReceipt`
  requires the claim to exist AND be bound to exactly this order, then verifies
  through the gateway (`trust.evidence`) before `trust.claimReceipt` +
  paid/confirmed + accounting capture. This is the ONLY electronic settlement
  path for manual orders — `updatePaymentStatus`'s cash/COD-only `mark_paid`
  rule was deliberately NOT relaxed.
- **Endpoints** (`server/routes/whatsappOrder.routes.js`, mounted in
  `server/server.js` next to `/api/orders`):
  - `POST /api/whatsapp-orders/:id/invoice` — super_adminOnly, 20/hr limiter.
  - `GET  /api/whatsapp-orders/:id/invoice?token=` — public, token-gated,
    timing-safe hash compare, `Cache-Control: private, no-store`.
  - `POST /api/whatsapp-orders/:id/pay-verify` — public; accepts `token` OR
    `reference` (Korapay's redirect may rewrite the query and drop the token;
    the claim binding makes reference-only settlement safe). 30/15min limiter.
- **Webhook**: `marketplaceWebhook.settle` routes `order.source === 'manual'`
  claims to `whatsappOrderInvoice.settleFromWebhook` instead of
  `trust.attach` (attach requires order.user === claim.user, which is the
  admin — wrong for guest-paid manual orders).
- **Hosted invoice page**: `client/apps/platform/src/app/invoice/[orderId]/page.tsx`
  — public, token-gated, states unpaid/ready/stale/paid, handles the
  reference-only redirect return with a compact paid confirmation.

## Admin app surfaces (`client/apps/admin`)

- The Orders page links platform staff to `/ecommerce/orders/whatsapp` (intake)
  and the intake links to `/ecommerce/orders/whatsapp/create` (builder).
  The `/ecommerce/:path*` middleware matcher covers both pages and
  `config/route-roles.ts` enforces platform-staff access. Old
  `/whatsapp-orders` bookmarks redirect to the corresponding nested pages.
- **Layout pattern**: The nested WhatsApp layout renders the
  `ModuleNavHeader` with links to Orders, Intake and New order.
- **Token accessor**: `useAuthorization()` from `@/hooks/use-authorization` →
  `user?.token` (not useSession).
- **Builder** (`shared/whatsapp-orders/`): customer-card (live
  `GET /api/users?search=` lookup — field is `phoneNumber`; match →
  "attaches to account" vs "guest"), product-picker-modal (cross-tenant
  `GET /api/subproducts?status=active&search=` — super_admin gets all tenants;
  display price is `Size.sellingPrice`, ADVISORY ONLY — the server re-prices),
  delivery-card (`/api/shipping/lgas` + `/api/shipping/calculate`),
  totals-panel. Pre-submit validation via `POST /api/cart/validate` (public,
  body `items: [{ subProductId, sizeId, quantity, price }]` — no tenantId).
  Session-scoped idempotency key (`dh:wa-order-attempt`).
- **Invoice panel**: `shared/whatsapp-orders/invoice-panel.tsx` rendered in
  `shared/ecommerce/order/order-view/index.tsx` (right column, after the
  status WidgetCard) when `order.originChannel === 'whatsapp'` — issue /
  re-send / fresh charge / copy link / paid badge. The order-detail PAGE is a
  thin server component delegating to `OrderView`, so the panel lives there.
  `GET /api/orders/:id` platform scope returns the raw doc, so
  `invoice`/`originChannel`/`placedBy` reach the panel with no server change.
- Known cosmetic gap: the intake list's "Placed by" column renders `—`
  because `getAllOrders` does not populate `placedBy` yet.

## Verification status

- New suites: `order.manualOrigin`, `trust.manualMetadata`,
  `manualOrder.create`, `whatsappOrderInvoice`, `whatsappOrder.routes` — all
  green, including inside the full-suite run.
- Full server suite: 4760 pass; all failures (~187 test lines across 38 files)
  are the `.mongo` venue/marketplace/platform-ops suites that require the
  local MongoDB replica set on 127.0.0.1:29127 (`connectVenueMongo` got an
  empty URI — replica set not running at test time). None of them touch
  payments/orders/whatsapp code paths.
- `client/apps/platform` and `client/apps/admin` `npm run type:check`: exit 0.

## LIVE SMOKE (2026-11-14, local mock Korapay) — PASSED, with 4 production fixes found

`KORAPAY_SECRET_KEY` in `server/.env` is a **live** (`sk_live_`) key, so the
smoke ran against a local mock gateway: `payment.service.KORAPAY_BASE_URL` is
now env-overridable (`KORAPAY_BASE_URL=http://localhost:5099/merchant/api/v1`),
with a mock that mimics initialize/charge-lookup (commit `0a…`/base-url change).
Full path verified: admin login → manual order (UI builder AND API) → invoice
issue → hosted invoice page → simulated payment → verified attach →
`paymentStatus: paid` → webhook idempotent → tenant (tenant_admin) sees the
order masked ("Online customer", own-tenant line only) → admin intake list +
order-detail panel + builder success screen (screenshots in the session tmp).

**Fixes the smoke surfaced (all committed):**
1. `order.controller` platform-staff check was `!req.user.tenant` — wrong: the
   seeded super_admin's JWT embeds a tenant snapshot. Now role-based, mirroring
   `orderAccess.platform`.
2. `issueInvoice` persisted the attempt counter only AFTER a successful
   initialize — a failed init left nothing saved, so every retry rebuilt the
   same requestKey and hit the same `uncertain` claim forever. Attempt+token
   are now persisted BEFORE the gateway call.
3. `trust.claimReceipt` wrote `user: data.user` — guest manual orders have
   `order.user = null` and MarketplacePaymentClaim requires a user. Falls back
   to the claim's original user.
4. **Builder UX**: the picker displays tenant retail price, but cart/validate
   compares against the marketplace price → `price_changed` on nearly every
   line. The builder now ADOPTS server-corrected prices/quantities (re-quotes
   delivery fee after correction) and blocks only `out_of_stock`/`unavailable`
   — mirroring checkout's Accept & Continue.
5. **Picker empty**: `limit=20` sorted by newest returned zero sellable
   listings → raised to 60.
6. **Platform UX**: marketing popups could cover the invoice page's Pay button;
   `PopupBanner` now skips `/invoice` routes entirely.

**Known smoke limitations:** the mock returns `payment_method: 'bank_transfer'`
and no 3-D Secure; real Korapay channel data will differ (evidence handles it).
Temp tenant-staff user `smoke-tenant@drinksharbour.dev` was removed after the
run. The unpaid second order DH2611140002 (from the UI builder drive) remains
as demo data.

## Gotchas

- `Size.sellingPrice` in the picker is the tenant retail price, NOT the
  marketplace customer price — totals shown in the builder are advisory; the
  created order's server-priced `totalAmount` is the truth (success screen
  shows it).
- No USSD on Korapay charges (channels `['card','bank_transfer']`).
- Claims older than 30 days need reconciliation → admin uses "Fresh charge"
  (new attempt/reference).

## WhatsApp Order Builder v2 (2026-11-14)

- The Sales-style builder adds product, section and note rows, a review panel,
  and live cart validation. Catalogue selections, Scan & Match candidates and
  barcode lookups all resolve through the same per-tenant offer picker.
  Platform staff can scan across tenants' published SubProducts. Tenant-scoped
  matching continues to use the actor's tenant.
- The picker loads `GET /api/subproducts/product/:productId?includeAll=true`
  and displays each tenant's sizes, stock and marketplace price. It reads
  `size.pricing.finalPrice ?? size.pricing.platformSellingPrice`. The
  debounced cart validation reconciles displayed prices and quantities.
  Order creation recalculates pricing on the server.
- The draft lives in `sessionStorage` under `dh:wa-builder-draft-v2`. It
  restores customer, delivery and lines in the current tab. The hydration
  guard in `5909f701` delays saving until restoration completes so an auth
  remount cannot replace the stored draft with empty initial state. Successful
  creation clears the draft and the separate order-attempt key.
- Manual creation accepts optional `manualOrder.printLines`. The server
  normalizes the row type and text and validates product indices. Each
  product row's zero-based `productIndex` points into the saved order's
  `items`. Section/note rows use a null index. Saved items carry the
  authoritative financial data.
- Quotation and invoice actions map the saved order to the shared document
  export dialog. The hosted invoice uses the same saved layout, including
  section subtotals and notes. Both paths fall back to item rows for legacy
  orders. The printed invoice includes payment status, including a paid
  stamp after settlement.

### Task 10 verification

- The previous browser run confirmed the v2 shell, the Lagar dos Perdigões
  Colheita Vinho Tinto catalogue selection from Wyn City at ₦28,800, and
  section/note restoration after reload. That catalogue fixture had one
  eligible tenant. ₦28,800 was its line price.
- The resumed run passed all 19 targeted server tests, covering manual
  creation, print-line normalization, cross-tenant scan scope, invoice
  routes, payment metadata and settlement. Admin and platform type checks
  passed, along with 16 admin print, catalogue and shared export tests.
- The resumed live smoke could not start. The admin, platform and mock
  gateway listeners returned `EPERM`, including a loopback-only bind test.
  The API's Atlas SRV lookup returned `ECONNREFUSED`. No new v2 order,
  final total or print/hosted-invoice screenshots were produced.
- Resume in a development environment with working local listeners, MongoDB
  access and the mock Korapay gateway. Use a single Playwright context, fill
  the street textarea within Delivery address, and reload mid-build to
  confirm the full draft. Complete the paste-scan path, create the order,
  check the quotation preview and persisted `printLines` via the order API,
  and check the hosted invoice and paid invoice print with mock settlement.
  Capture screenshots from that order. The v1 demo orders above predate
  the v2 print layout.
