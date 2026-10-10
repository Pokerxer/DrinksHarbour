---
name: Tenant website REST API
description: Tenant-scoped catalogue and guest Paystack checkout for custom ecommerce sites
type: project
---

Implemented locally on 2026-10-04, uncommitted. Settings API keys have a Tenant
website preset (`storefront:read`, `checkout:write`) and a setup guide. API base:
`/api/integrations/v1`; products, quotes, checkout/create/read/verify/cancel.

Keep API keys on website servers, separate from JWT authority. Never use client
prices/payment status or a generic create-order/attach-payment adapter for this
flow. Tenant, variant, prices, shipping, currency and reference are authoritative.
Transactions reserve both parent and Size stock. SHA-256 primary checkout IDs
bind tenant/key/idempotency headers even before secondary indexes build.

Own pending central submissions remain tenant-sellable, scoped explicitly by
`Product.submittingTenant`; other tenants' pending entries are excluded.
Uncertain initialization returns 202 and retains the payment reference. Raw-byte
Paystack HMAC and matching amount/reference/currency precede settlement. Late
payments after cancellation require refund review instead of fulfillment.

Verification refreshed 2026-10-05: backend 3391 passed, 1 opt-in skipped;
real isolated replica-set suite 8/8 including the full HTTP journey through real
API-key authentication, all eight endpoints, read-only scope rejection, revocation
and expiry. Gateway and accounting boundary responses are mocked; database and
HTTP behavior are real. Admin API keys/documentation 20/20; complete admin retry
with two workers 2459/2459. Initial unconstrained run hit inventory browser test
and worker timeouts; reduced concurrency resolved them. Typecheck still reports
392 errors, none in the API keys/documentation files.

Added `/settings/api-keys/documentation` with server-rendered reference sections,
settings navigation, anchors, private-server helper, copyable connection/checkout
examples and role access tests. Markdown guide remains the full repository reference.

Guide: `docs/api/tenant-websites.md`. Handoff:
`docs/superpowers/specs/RESUME-tenant-website-rest-api.md`.
No live payments/data writes or deployment verified; requires transactional
MongoDB, Paystack configuration and the production cleanup cron.

Banner feed added 2026-10-05: GET /banners (storefront:read), with placement/device/limit filters. See tenant-store-banners.md. Current reference contains nine endpoints.

REST price compatibility fixed 2026-10-07: active legacy `in_stock` Size variants
now expose real prices and remain purchasable with sufficient stock. Catalogue
reads include active sold-out variant prices with public stock zero; cart queries
exclude them. Shared escapeRegex import corrected for product search.
Real API/browser confirmed Pineapple Tequila ₦115,300 and stock 11.
Backend 3,405 passed, 0 failed, 2 skipped. No database writes/deployment.
Handoff: docs/superpowers/specs/RESUME-rest-legacy-size-prices.md.
