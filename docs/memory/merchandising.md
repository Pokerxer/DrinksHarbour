# Merchandising — Upsell & Cross-sell Pipeline

Date: 2026-11-14. Spec: docs/superpowers/specs/2026-11-13-merchandising-upsell-cross-sell-design.md.
Plan: docs/superpowers/plans/2026-11-14-merchandising-upsell-cross-sell.md.

## What exists now
- `server/config/merchandising.js` — beverage family map (type→family) + family pairings.
  Families reuse `expandedProductTypes` group names; non-beverage retail verticals map to
  OTHER, which pairs with nothing (always falls through to semantic/related tiers).
- `server/services/merchandising.service.js` — tiered hybrid engine:
  boughtTogether: co-purchase → pairing_rules → related_fallback;
  crossSells: pairing_rules → semantic; upSells: price_band → brand_premium → semantic.
  Every item carries `source`. Process-local 5-min Map cache, no Redis.
- `GET /api/products/:id/merchandising?context=pdp|cart` (public). Marketplace surface =
  beverage-only aggregates; tenant storefront (x-is-tenant-site + x-tenant-slug) = that
  tenant's published, online-visible SubProducts at `baseSellingPrice`.
  Old dead endpoints/controllers for /bought-together, /cross-sells, /upsells were deleted.
- Platform frontend: `useMerchandising` hook; PDP `BoughtTogether` bundle +
  "Step Up Your Pick" rail (reuses RelatedProducts); cart `CartCrossSellStrip`.
  GA4: view_item_list with item_list_id bought_together / cart_cross_sell;
  add_to_cart_merchandising carries the recommendation `source`.

## Rules to keep
- Cross-sell pairings must reference families that have enum members (test-enforced in
  merchandisingConfig.test.js). New Product.type values must be mapped in
  server/config/merchandising.js.
- Cart context never excludes in-cart items server-side; the client filters (cart state
  is client-owned).
- No costPrice/vendor PII in any recommendation payload (Workstream B).

## Phase 2 (2026-11-14)

Plan: docs/superpowers/plans/2026-11-14-merchandising-phase2.md. Ads money-path
agreement: docs/memory/ads-billing.md.

### Manual pairings (Growth+)
- `server/models/MerchandisingPairing.js` — one row per tenant per source product;
  `suggestedProducts` = 1–4 unique central Product refs; unique index
  `{tenant, sourceProduct}`. Capability `merchandising_manual` on
  growth/pro/enterprise/venue/custom only (`server/config/erm-plans.js`,
  `EXTRA_CAPABILITIES`).
- `server/services/merchandisingPairing.service.js` +
  `server/controllers/merchandisingPairing.controller.js` +
  `server/routes/merchandisingPairing.routes.js` (mounted
  `/api/merchandising/pairings`; GET/PUT/DELETE; all `protect` +
  `requireCapability('merchandising_manual')`; tenant from JWT only). Upsert
  validates ids against the central catalog and refuses the source product in
  its own suggestions.
- Merge layer in `server/services/merchandising.service.js`: on the tenant
  storefront (`tenantId` set) the active pairing's suggestions — re-verified
  sellable via `hydrateCards` — lead `crossSells` and `boughtTogether` tagged
  `source: 'manual'`, ahead of every automatic tier; automatic items fill the
  remainder under the same per-kind cap. upSells are untouched (an upsell is a
  premium alternative, not a pairing). The marketplace surface never consults
  tenant-private pairings. Manual edits become visible within the 5-min
  process-local cache TTL (documented, acceptable).
- Tenant dashboard module (mirrors the Banners module):
  `client/apps/admin/src/app/(hydrogen)/merchandising/` + create page,
  `app/shared/merchandising/pairings/` (table/columns/form/picker),
  `services/merchandisingPairing.service.ts`, registered in `config/routes.ts`,
  `config/route-roles.ts`, `middleware.ts`, `config/plan-capabilities.ts`
  (`/merchandising` gated on `merchandising_manual`), nav entry
  `layouts/hydrogen/tenant-menu-items.tsx`.

### Sponsored ads (CPC, prepaid)
- Models: `server/models/AdCampaign.js` (surfaces pdp/cart, status
  draft|active|paused|budget_exhausted|expired|suspended, spentToday/spentDay/
  spentTotal/clicksTotal/impressionsTotal, dailyBudget ≥ tariff),
  `server/models/AdClickDedupe.js` (unique `{campaign, visitorKey, day}`),
  `server/models/AdWalletTransaction.js` (append-only ledger). Wallet field
  `Tenant.adWalletBalance`. Tariff: `server/config/ads.js` `CPC_TARIFF_NGN`
  (default 50, env `ADS_CPC_TARIFF_NGN`) — a platform decision, NOT a market
  rate; never call it a market rate in copy.
- Money path: `server/services/adWallet.service.js` (atomic filter-guard
  debit; idempotent credit by Paystack reference), campaigns
  `server/services/adCampaign.service.js` + routes
  `/api/ads/campaigns` (CRUD, status PATCH, summary with `cpcTariff`,
  wallet-gated activation), clicks `server/services/adClick.service.js` +
  routes `/api/ads/clicks|impressions/:campaignId` (public, allowlisted
  write-only beacons). Top-up: `POST /api/payments/paystack/initialize` with
  `metadata.purpose='ad_wallet'` + `Idempotency-Key` header, settled by
  `server/services/adWalletTopup.service.js` through BOTH the verify path
  (`payment.controller.js`) and the webhook (`paystackWebhook.js`);
  `marketplacePaymentTrust.evidence` refuses ad_wallet receipts from funding
  orders. Details and invariants: docs/memory/ads-billing.md.
- Clicks are deduped per campaign+visitor+day; wallet-empty pauses the
  campaign; daily-budget exhaustion marks `budget_exhausted`. Sponsored cards
  carry `source: 'sponsored'` + `adCampaignId`; disclosure badge
  `client/apps/platform/src/components/Merchandising/SponsoredBadge.tsx` is
  mandatory at every render site. Placement is context-dependent (fix
  2026-11-14): `pdp` campaigns surface in the disclosed sponsored list above
  the Step-Up rail (`components/Product/Detail/index.tsx` — the rail and the
  bought-together bundle stay organic); `cart` campaigns surface in
  `components/Merchandising/CartCrossSellStrip.tsx`. BoughtTogether keeps
  defensive sponsored handling (`source === 'sponsored'` → badge + click) but
  the server no longer routes paid cards into the bundle.
  Click attribution: `fireSponsoredClick` in `useMerchandising.ts` fires
  `POST /api/ads/clicks/:adCampaignId` before the user action (cart strip +
  BoughtTogether).
- GA4: no new sponsored-click gtag event — CPC attribution is server-side
  (click endpoint); GA4 events carry `source: 'sponsored'` through the existing
  `add_to_cart_merchandising` / `view_item_list` payloads. The PDP disclosed
  sponsored list's links fire `fireSponsoredClick` on navigation (fixed
  2026-11-14, same as cart strip + BoughtTogether).
- Tenant dashboard Advertising module (ungated by plan — à la carte revenue):
  `client/apps/admin/src/app/(hydrogen)/advertising/`,
  `app/shared/ads/` (wallet-card, campaigns-table/-columns, campaign-form,
  budget-fields), `services/ads.service.ts`, same five registration files.

### Mini-cart upsell
- `ModalCart` renders the phase-1 `CartCrossSellStrip` ("goes well with what's
  in your cart") inside the items area when the cart is non-empty
  (`client/apps/platform/src/components/Modal/ModalCart.tsx`); the modal stays
  open on quick-add.
- PDP `components/Product/Detail/index.tsx` opens the modal after a successful
  add-to-cart (`openModalCart()`); the success toast is removed in favor of
  the modal — toasts remain for errors only.
- Test: `components/Merchandising/ModalCartUpsell.test.tsx`.

### Phase-2 server tests
`server/__tests__/merchandisingPairing.test.js`, `adsModels.test.js`,
`adWallet.test.js`, `adCampaign.test.js`, `adWalletTopup.test.js`,
`adClick.test.js`, extended `merchandising.test.js`,
`routeGuardCoverage.test.js` (public beacon allowlist).
