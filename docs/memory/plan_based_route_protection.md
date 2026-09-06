---
name: plan_based_route_protection
description: How plan entitlements gate admin routes — capabilities are a set not a ladder, the client mirror is not enforcement, and which gates are deliberately absent and why.
type: memory
---

# Plan-based route protection — the map, not the gate

Capability table: `client/apps/admin/src/config/plan-capabilities.ts`
(`ROUTE_CAPABILITIES`); server gate: `server/middleware/plan.middleware.js`
(`requireCapability`) + `server/middleware/tenant.middleware.js`
(`assertWritesAllowed`). Rules are in
`server/config/README-plan-entitlements.md` §1/§5a and `planCapabilities.test.js`.

## Capabilities are a set, not a ladder

`FEATURE_COMPARISON` is non-monotonic (POS single superseded by multi;
Basic CRM superseded by advanced). **Never gate on `rank(plan) >= rank(x)`** —
gate on capabilities, accept ANY of the tiered values
(`ANY_POS`, `ANY_CRM`). `/point-of-sale` needs
`pos_single OR pos_multi OR pos_realtime` or every Pro/Enterprise/Venue tenant
403s.

Ordinal helpers only for genuinely-ordinal things: skuLimit, staffLimit,
commissionRate, naming the cheapest unlockable plan (`upgradeTo`).

## The client mirror is NOT enforcement

`ROUTE_CAPABILITIES` (client) mirrors the server table and powers the nav
filter + middleware redirect to `/upgrade-required`. The API is the real
boundary. `requireCapability` must exist server-side for every row the pricing
page sells; the client map is a fast redirect, not authority.

## Gates deliberately absent (with reasons — README §5a)

- `ANY_POS` and `inventory`: every one of the 7 plans holds them — a gate
  could never refuse anyone.
- The five `legacyMinPlan` routes (/analytics, /banners,
  /ecommerce/reviews, /roles-permissions, /logistics): thresholds are
  client behaviour for features the comparison table does not price.
  Enforcing them server-side = inventing pricing (product decision).
- `mail.routes.js`: no `attachTenant`; a capability gate there resolves to the
  empty set and refuses EVERYONE including platform staff. Needs tenant
  context added first.
- `/:id/transfer` (SubProduct): grows the DESTINATION's SKU count and
  `req.tenant` is the source. Needs the target's plan; privileged op already
  audit-logged.
- `api_access` (Pro+): sold with NO admin screen — no API-keys page exists.
- `table_management` / `event_booking` / `bar_inventory` (Venue): live in the
  POS app, not the admin.

**Do not "fix" any of these without a product decision written next to it.**

## Platform staff are exempt FIRST

`super_admin` / `admin` have no tenant → no plan → an unconditional gate reads
`undefined` as `free_trial` and locks the platform team out. EVERY gate
(server middleware, Next middleware, layout guard, nav filters) short-circuits
for platform roles before consulting the plan.

## Where the admin client enforces

- `client/apps/admin/src/middleware.ts` — fast redirect from the JWT's cached
  plan copy, redirects to `/upgrade-required?feature=…&from=…&plan=…`.
- `app/layout.tsx` — authoritative check against the LIVE tenant document;
  substitutes `<UpgradeRequired>` for children rather than redirecting.
- The API (`requireCapability`) is the actual boundary and the only one that
  matters for security.