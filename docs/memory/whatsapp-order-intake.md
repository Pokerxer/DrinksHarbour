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

- Module: `/whatsapp-orders` (intake list) + `/whatsapp-orders/create`
  (builder). Gated super_admin/admin in `config/route-roles.ts` (before the
  PLATFORM_ROLES early-return — tenant roles otherwise fall through to true),
  matcher added to `middleware.ts`, nav entry in
  `layouts/hydrogen/menu-items.tsx`.
- **Layout pattern**: `(hydrogen)/whatsapp-orders/layout.tsx` renders the
  `ModuleNavHeader` (brand + tabs); the views render plain content — no page
  renders its own header.
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
- MANUAL SMOKE STILL PENDING (plan Task 10 step 3): needs dev servers + Korapay
  sandbox — create order → issue invoice → open link → sandbox pay → verify
  paid state, tenant queue, webhook path.

## Gotchas

- `Size.sellingPrice` in the picker is the tenant retail price, NOT the
  marketplace customer price — totals shown in the builder are advisory; the
  created order's server-priced `totalAmount` is the truth (success screen
  shows it).
- No USSD on Korapay charges (channels `['card','bank_transfer']`).
- Claims older than 30 days need reconciliation → admin uses "Fresh charge"
  (new attempt/reference).
