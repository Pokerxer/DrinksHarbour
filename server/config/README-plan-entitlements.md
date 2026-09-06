# Plan entitlements — the rules

What a tenant may reach, and why. These are **business rules**, not
implementation detail: change them here first, then in code.

Related code:
- `server/config/erm-plans.js` — the capability table (canonical).
- `server/services/entitlements.service.js` — resolution (status, dunning, custom).
- `server/middleware/plan.middleware.js` — the gates.
- `client/apps/admin/src/config/plan-capabilities.ts` — the client mirror + route map.
- `server/__tests__/planCapabilities.test.js` — fails if any of the above drift.

---

## 1. Capabilities are a set, not a ladder

The pricing page's `FEATURE_COMPARISON` is non-monotonic in two rows:

| Row | free_trial | starter | growth | pro | enterprise | venue |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| POS (single outlet) | ✓ | ✓ | ✓ | · | · | · |
| Basic CRM | · | · | ✓ | ✓ | · | · |

A `·` there means **superseded**, not withheld — Pro has multi-outlet POS
instead, Enterprise has advanced CRM instead. So:

> **Never gate a feature on `rank(plan) >= rank(x)`.** Gate on capabilities, and
> where a feature has tiers, accept **any** of them.

`/point-of-sale` requires `pos_single OR pos_multi OR pos_realtime`. CRM
surfaces require `crm_basic OR crm_advanced`. Gating POS on `pos_single` alone
would 403 every Pro, Enterprise and Venue tenant.

The ordinal helpers (`PLAN_ORDER`, `isPlanAtLeast`) remain, but only for things
that genuinely are ordinal: `skuLimit`, `staffLimit`, `commissionRate`, and
naming the cheapest plan that unlocks a capability.

## 2. Which source wins

For the 15 rows `FEATURE_COMPARISON` covers, **the comparison table wins** and
`ERM_PLANS[*].features` is pinned to it by test.

Plans may carry extra capabilities the table does not mention — they come from
the `PLAN_TIERS` marketing cards. They are enumerated in `EXTRA_CAPABILITIES`
(`pos_realtime`, `guest_crm`, `custom_integrations`, `priority_support`) so a
typo cannot pass for one.

Two divergences were found and corrected when this was written:

1. `storefront` was in no plan's `features[]`, though the table grants "Branded
   storefront" to all six.
2. `venue` had `pos_realtime` but not `pos_multi`, though the table grants venue
   "POS (multi outlet)". Venue now carries both.

## 3. `custom`

`custom` is in the `Tenant.plan` enum but is not sold and is not a rung on the
price ladder. Before this work it failed in **opposite directions** on the two
sides: `PLAN_ORDER.indexOf('custom')` was `-1`, so `isPlanAtLeast('custom', …)`
was always `false` and the server refused a custom tenant everything; the admin
client's `PLAN_RANK` scored it `6` — the highest — so the menu offered it
everything.

Now:

- `ERM_PLANS.custom` exists, mirroring the enterprise set, with `Infinity`
  limits and no `paystackPlanCode`.
- `isPlanAtLeast('custom', …)` returns `true` explicitly.
- `Tenant.customCapabilities[]` overrides the default set — narrower **or**
  wider, since a negotiated contract is by definition not one of the six. It is
  ignored for every other plan, so it cannot be used to upgrade a starter tenant
  by writing to one array.

## 4. Subscription status and dunning

| `subscriptionStatus` | Tenant context | Capabilities | Writes |
|---|---|---|---|
| `active` | yes | plan set | allowed |
| `trialing`, `trialEndsAt` in the future (or unset) | yes | plan set | allowed |
| `trialing`, `trialEndsAt` elapsed | yes | `free_trial` set | **refused** |
| `past_due` | yes | plan set | **refused** |
| `canceled`, `incomplete`, `incomplete_expired` | **no** | — | **refused** |

And on `Tenant.status`: `suspended` or `archived` → **no capabilities at all**.
`pending` and `rejected` are left alone; they are onboarding states, not
punishments.

Lapsed tenants keep core inventory/orders rather than being locked out
entirely, deliberately: a tenant must be able to read their own books and wind
down. Locking them out turns a billing problem into a support incident.

### DECISION — `past_due` is read-only, not a lockout

**Resolved 2026-09-06. The code and this table agreed only after this change.**

The guard in `middleware/tenant.middleware.js` used to refuse `req.tenant`
outright unless `subscriptionStatus ∈ {active, trialing}`, so a `past_due`
tenant lost the entire admin dashboard rather than merely their writes. That
was harmless only while nothing wrote `past_due`. The moment the
`invoice.payment_failed` webhook fires against real traffic it becomes an
outage — and the decisive detail is that **`/api/erm` sits behind
`requireTenant` too**, so a locked-out tenant could not reach the billing page
to pay. Dunning with no route back to paying is not dunning.

So the **existence** gate is relaxed for `past_due` and the **write** gate now
sits next to it:

- `TENANT_CONTEXT_STATUSES = ['active', 'trialing', 'past_due']` decides who
  gets a `req.tenant` at all. `canceled`, `incomplete` and `incomplete_expired`
  are still denied outright — a subscription that is gone is not in dunning.
- `assertWritesAllowed` runs inside `requireTenant`, `requireOwnTenant` and
  `verifyActiveSubscription`, and refuses `POST/PUT/PATCH/DELETE` whenever
  `resolveEntitlements(...).writesAllowed` is false. It raises the same
  `SUBSCRIPTION_READ_ONLY` code `requireCapability` does, so the client has one
  branch to handle.
- `allowBillingWrites` exempts exactly one router — `/api/erm` — because that
  is the way out of the read-only state.

**Why the write block is in the tenant guard and not left to
`requireCapability`.** Most tenant-owned routers carry `requireOwnTenant` and
no capability gate at all. Relaxing the status list without moving the write
check would have turned a total lockout into *full write access* on exactly
those routes.

Two consequences worth knowing:

- **An elapsed trial is now read-only in the same way**, since
  `resolveEntitlements` reports `writesAllowed: false` for it. Combined with
  §4a below (which finally populates `trialEndsAt`), tenants who have been
  `trialing` open-endedly will begin to degrade.
- **A `past_due` storefront stays up.** `resolveTenantContext`'s subdomain
  branch admits it too: taking a merchant's shop offline over one failed card
  punishes their customers, and the platform still earns commission on what
  sells. Dunning stops the tenant's own writes, not their storefront.

Pinned by `__tests__/tenantIsolation.test.js`.

### 4a. `trialEndsAt` is populated now

`free_trial` is the schema default for `subscriptionStatus`, and
`resolveEntitlements` reads a **missing** `trialEndsAt` as "never expires". The
only creation path that ever set it was the public vendor-registration form —
so a tenant created from the platform admin form, a seed script or a test was
on a permanent free tier.

It is stamped in the `Tenant` pre-save hook (`applyTrialWindow`, `TRIAL_DAYS`
in `erm-plans.js`), which every creation path passes through. An explicitly
supplied date is left alone, an existing document is never re-stamped, and a
tenant that is not `trialing` is not given one.

The `subscription.create` webhook clears it: a tenant who is paying must not be
degraded when an old trial date passes.

#### DECISION — nothing needs grandfathering; the retroactive gate is safe to ship

**Resolved 2026-09-06, from counts rather than from reasoning.** The write gate
is retroactive — it reads the tenant's state now, not when they signed up — so
before deploying it somebody had to know how many live tenants it flips.

`node scripts/auditTrialState.js --all` against `cluster0.ukrr40p / drinksharbour`
on 2026-09-06, re-run read-only at 18:11 UTC before deploy:

| Population | Count | What the deploy does to them |
|---|--:|---|
| `active` | **1** | nothing — `wyncity` (enterprise) |
| `trialing`, `trialEndsAt` in the future | **1** | nothing — `ufg-legacy-limited` (free_trial), ends **2026-09-20** |
| `trialing`, `trialEndsAt` elapsed | **0** | — |
| `trialing`, no `trialEndsAt` | **0** | — |
| `past_due` | **0** | — |
| `canceled` / `incomplete*` | **0** | — |

**Zero tenants change behaviour on deploy.** So there is no commercial call to
make and no backfill to run: the grandfather-vs-degrade question the write gate
raised has an empty subject. The write modes on the script
(`--backfill-open-ended`, `--grandfather-elapsed=<days>`,
`--convert-comped-to-trial`) exist for the next time this is asked, not because
anything is pending.

Two things changed since the first read on this day, both worth carrying forward
rather than re-deriving:

- **The data moved between reads.** The first read on 2026-09-06 showed
  `ufg-legacy-limited` as `active` + `plan: free_trial` with no `currentPeriodEnd`
  — the "comped" population, writable forever, never degrading, and invisible to
  the trial-ending email. By the 18:11 re-read it is **`trialing` with
  `trialEndsAt: 2026-09-20`** (+14 days), i.e. on a normal trial that **will go
  read-only on 2026-09-20** unless it subscribes or is extended. The comped D-forever
  state is gone from the live data; the `--convert-comped-to-trial` mode that
  exists to produce exactly this shape is no longer needed for this tenant.
- **The forward-looking question is now real for one tenant.** Rather than
  "grandfather or degrade?" (empty subject), the live question is "allow
  `ufg-legacy-limited` to lapse silently on 9/20, or warn/convert it first?" That
  is the trial-ending email decision in `subscription-billing-next-goals-2.md` §D,
  not something the audit resolves. It is recorded here so nobody re-derives it.

Still to carry forward:

- **Re-run the audit before deploying to any environment whose tenant data this
  was not read from.** The numbers above are one cluster on one day; the script
  is the durable artefact, not the table.
- `wyncity` is `active` with no `currentPeriodEnd` — a paying-looking tenant with
  no subscription period, worth recognising rather than mistaking for a normal
  customer. It is unaffected by the write gate either way.

### 4b. Billing configuration is environment state, not code

`node scripts/checkErmBillingConfig.js` reports, for the environment it is run
in, whether `PAYSTACK_SECRET_KEY` and all seven `PAYSTACK_PLAN_*` codes are set,
and what each missing one breaks. `--verify-remote` additionally asks Paystack
whether the configured codes exist and are priced as the pricing page claims.

On this repo's `.env` as at 2026-09-06: the secret key is a **test** key, and
**all seven plan codes are unset** — not only the two new add-on ones. So
`POST /api/erm/subscribe` is as unconfigured as `POST /api/erm/add-ons`; both
refuse rather than granting anything free, which is the designed behaviour, but
neither can complete a purchase until the plans exist in the Paystack dashboard
and their codes are set on the **production backend**.

The webhook URL registration has no API to read it back and must be confirmed by
eye in the dashboard. See `korapay_redirect_url_outage` for the precedent: one
unset production env var on this exact surface has already caused one outage.

## 5. Add-on quotas

The pricing page sells extra shop **₦12,000/mo** and extra warehouse
**₦20,000/mo**, *first of each free*. Nothing counted against that before —
both were unbounded.

Allowance = `1 + (plan.addOnsAllowed ? sum(addOns[type].quantity) : 0)`.

Plans that cannot buy add-ons (`free_trial`, `starter`, `growth`) get the one
free unit and no more. Enforced by `checkWarehouseLimit` and `checkShopLimit`.

The arithmetic is `addOnAllowance` in `erm-plans.js` and nowhere else, because
`GET /api/erm/status` reports the same number the middleware enforces. Two
copies would drift and the billing screen would offer a slot the gate refuses.

### DECISION — every row counts; deactivating does not free a slot

**Resolved 2026-09-06.** The four sold limits used to disagree about this, all
but one in the same direction, and the odd one out was `checkShopLimit`.

| Gate | Counted | Was |
|---|---|---|
| `checkSkuLimit` | every `SubProduct` on the tenant, `archived` and `discontinued` included | same — unchanged |
| `checkStaffLimit` | every tenant-scoped `User`, `suspended` / `inactive` / `deleted` included | same — unchanged |
| `checkWarehouseLimit` | every `Warehouse`, `isActive: false` included | same — unchanged |
| `checkShopLimit` | every `posSettings.shops[]` row, `active: false` included | **filtered `active !== false`** |

**The rule: a limit counts rows, and the way to free a slot is to delete the
row, not to deactivate it.** So only `checkShopLimit` moved, and it moved to
join the other three. The count is `countedShops(tenant)` in `erm-plans.js`,
beside `addOnAllowance` and for the same reason — `GET /api/erm/status` reports
it and the gate enforces it, so it must be one function.

Deleting really is available for three of the four, which is what makes the
rule livable:

- `DELETE /api/pos/shops/:shopId` removes the subdocument outright.
- `DELETE /api/warehouses/:id` hard-deletes, refusing only while stock remains.
- `DELETE /api/subproducts/:id` hard-deletes, refusing only while stock remains.
  (`PATCH /:id/archive` is a *visibility* change and deliberately frees nothing.)

#### The exception, and it is a real one: staff have no hard delete

`DELETE /api/employees/:id` is a **soft** delete — `user.status = 'deleted'`,
the row stays. There is no route that removes a tenant-scoped `User`. Under the
rule above that row keeps occupying a seat forever, so:

> **A Starter tenant (`staffLimit: 1`) who removes their one staff member can
> never add a replacement.** The gate counts the `deleted` row, the tenant has
> no way to remove it, and their only exits are upgrading or a support ticket.

This is recorded rather than quietly patched because the counting rule was a
product decision and this is its cost. If it is to be fixed, fix it where the
dead end is — either exclude `status: 'deleted'` from `checkStaffLimit` alone
(deleted is not a state a tenant can leave, unlike `suspended`), or give
employees a real delete. Do **not** re-split the rule across all four gates;
that is the state this decision replaced.

No index work was needed: counting every row uses the existing `{ tenant: 1 }`
indexes on `SubProduct`, `User` and `Warehouse`, and shops are a subdocument
array already in memory. The commented-out `subProductSchema.index({ tenant: 1,
status: 1 })` (`models/SubProduct.js` ~line 725) stays commented out — a
filtered SKU count would have needed it, and this rule does not filter.

### 5b. DECISION — the usage counts are cached; the entitlement is not

**Resolved 2026-09-06, from measurement.** `app/layout.tsx` fetches
`GET /api/erm/status` server-side on **every admin page render**, to decide
whether to draw the read-only banner — which for a healthy tenant draws
nothing. `getStatus` ran four `countDocuments` to build the usage meters, so
every page view of every screen paid for them.

`node scripts/measureErmStatusCost.js` against `cluster0.ukrr40p /
drinksharbour`, 12 runs per tenant:

| Tenant | Rows | Uncached p50 | Uncached p95 | Cache hit p50 |
|---|---|--:|--:|--:|
| `wyncity` (enterprise) | 995 SKUs / 40 staff / 3 warehouses | **126 ms** | 972 ms | 0.01 ms |
| `ufg-legacy-limited` (free_trial) | 5 / 1 / 1 | **124 ms** | 127 ms | 0.00 ms |

So it was **~125 ms of Atlas round-trips on every page render**, for a banner
that is usually not shown. Not a rounding error, and it grows with the
catalogue. Cached in `services/ermUsage.service.js`, TTL 45 s.

**What is cached is the point.** Only the three collection counts — they are
the cost, they are only ever *reported*, and a usage meter a few seconds stale
is invisible. Everything that decides what a tenant may **do** (`plan`,
`subscriptionStatus`, `trialEndsAt`, `writesAllowed`, `entitlementReason`,
`entitlementMessage`) is still derived per request from the `req.tenant`
document `attachTenant` loads fresh. So:

- the read-only banner is **never stale** — a tenant who pays stops seeing it on
  their next page load, not up to 45 s later;
- the **limit gates never read the cache**. `checkSkuLimit`, `checkStaffLimit`
  and `checkWarehouseLimit` each run their own live count, because enforcing a
  quota against a count that may be seconds old is how a tenant gets one more
  SKU than they bought. The cache is for reporting only.

Invalidation is **in the gates and nowhere else**: they are mounted on every
door that creates a counted row (§5a), so "a gate just ran" is a reliable proxy
for "a row is about to appear". Scattering `invalidateUsage()` through the
controllers would drift the moment a seventh door opened.

The alternative considered and rejected was deriving `writesAllowed` in the
client from the tenant document the layout already fetches. It removes the same
cost, but it means mirroring `resolveEntitlements` — and the wording with it,
undoing the single source that §4's `readOnlyMessage` exists to be.

### `Tenant.addOns[]` is written now

It used to be written by nothing, so every tenant was capped at one shop and
one warehouse however much they paid. The flow:

- `POST /api/erm/add-ons` starts Paystack checkout for **one unit**. Paystack
  plans have no quantity concept, so buying two means two subscriptions —
  pretending otherwise would bill for one unit and grant two.
- The row is written only when `subscription.create` arrives, keyed on
  `subscription_code` so a webhook retry is a no-op rather than a free
  warehouse. Writing it at checkout would hand a slot to anyone who opened the
  payment page and closed it.
- `DELETE /api/erm/add-ons/:addOnType` disables that subscription and pulls one
  row — matched on `_id`, because a `$pull` on `{type}` removes *every*
  matching row and would revoke slots still being paid for.

Each add-on is its own subscription, which is what makes the webhook branching
load-bearing: an add-on's `invoice.payment_failed` must **not** put the tenant
into dunning, and an add-on's `subscription.disable` must **not** cancel the
tenant. `addOnTypeForEvent` decides, from our metadata first and the Paystack
plan code second — Paystack does not carry transaction metadata onto renewals
and disables that arrive months later.

### Staff limits

`staffLimit` (1 / 1 / 3 / 10 / unlimited) was sold on every card and enforced
nowhere: `checkStaffLimit` was exported and imported by no route file. It is
now mounted on both paths that create a tenant-scoped user — `POST /api/employees`
and `POST /api/pos/cashiers` — since adding staff from the POS screen instead
of the HR one must not be a way around the plan. `checkShopLimit` had the same
problem and is now on `POST /api/pos/shops`.

## 5a. Which doors each limit is actually behind

**Audited 2026-09-06.** `checkStaffLimit` and `checkShopLimit` had both been
written and mounted nowhere; that turned out not to be the last instance.

### SKU limit — was one guarded door out of four

`checkSkuLimit` was mounted only on `POST /api/subproducts`. Three other routes
create SubProducts and had no gate at all:

| Route | Creates | Now |
|---|---|---|
| `POST /api/subproducts` | 1 | `checkSkuLimit` (unchanged) |
| `POST /api/subproducts/bulk` | one per `productIds[]` entry | `checkSkuLimitFor(len(productIds))` |
| `POST /api/subproducts/:id/duplicate` | 1 | `checkSkuLimit` |
| `POST /api/subproducts/import/commit` | one per new group | a **budget**, see below |

Two things the fix had to get right:

- **A "room for one more?" check is wrong for a bulk route.** `/bulk` takes an
  array, so the old gate would have let a tenant one SKU under their cap create
  five hundred. `checkSkuLimitFor(countRequested)` asks how many. The default
  resolver returns 1, so the single-create route behaves exactly as before
  (`count >= limit` and `count + 1 > limit` refuse in the same cases).
- **The CSV import cannot be gated by a middleware at all.** It knows its row
  count but not how many rows become NEW SubProducts — a row matching an
  existing one is an update — so refusing on `rows.length` would reject a
  500-row file that only creates ten. Instead the controller computes
  `skuBudgetFor(tenant)` and `commitImport` spends it, reporting what it could
  not create as `skippedOverLimit` plus one entry per group in `errors[]`. An
  import that silently stopped creating halfway would read as "imported fine".

`SubProduct.create` also appears in `services/product.service.js`, reached only
by `POST /api/products`, which sits behind `authorize('super_admin','admin')` —
a platform action against a central Product, not a tenant creating a listing.
The seed scripts create SubProducts directly and are deliberately outside every
gate; they run as an operator, not as a tenant.

**Known and left alone:** `POST /api/subproducts/:id/transfer` moves a
SubProduct to another tenant, so the DESTINATION gains a SKU it was not gated
for. `checkSkuLimit` reads `req.tenant`, which is the source. Enforcing it would
need the target tenant's plan, and a transfer is a privileged operation already
recorded in the `AuditLog`. Written down rather than half-fixed.

### Capability gates — the client map is a mirror, not enforcement

Walking `ROUTE_CAPABILITIES` (`client/apps/admin/src/config/plan-capabilities.ts`)
against the server:

| Client route | Capability | Server gate |
|---|---|---|
| `/accounting` | `advanced_reports` | `accounting.routes.js` |
| `/sales`, `/invoice` | `sales_invoicing` | `salesOrder.routes.js` |
| `/purchases` | `purchase_orders` | `purchaseOrder`, `purchaseAgreement`, and now `vendor`, `vendorBill`, `vendorReturn`, `vendorPricelist`, `reorder` |
| `/contacts` | `ANY_CRM` | `contact.routes.js` |
| `/point-of-sale`, `/pos` | `ANY_POS` | none needed — see below |
| `/inventory`, `/warehouses` | `inventory` | none needed — see below |
| `/store-analytics` | `advanced_reports` | none needed — the screens make no API calls |

**Five routers of the purchases module were open.** `purchase_orders` is Growth
and above, and only two of the module's seven routers carried the gate. A
Starter tenant refused `/purchases` in the UI could still call
`/api/vendors`, `/api/vendor-bills`, `/api/vendor-returns`,
`/api/vendor-pricelists` and `/api/reorder` directly. All five now carry it.

**`ANY_POS` and `inventory` need no server gate, and that is not an oversight.**
Every one of the seven plans holds `inventory`, `orders`, `storefront` and one
of the POS capabilities — `free_trial` has `pos_single`. A `requireCapability`
on those can never refuse anybody. The client entries stay because they document
the pricing table; adding the server mirror would be ceremony that enforces
nothing. If a plan is ever sold without POS or inventory, they become real gates
and must be mounted then.

**Deliberately still ungated, with reasons:**

- The five `legacyMinPlan` routes (`/analytics`, `/banners`,
  `/ecommerce/reviews`, `/roles-permissions`, `/logistics`) have no server gate.
  Their thresholds are pre-existing client behaviour for features
  `FEATURE_COMPARISON` does not price. Enforcing them server-side would be
  inventing pricing, which is a product decision, not a code one.
- `mail.routes.js` backs the `/support` inbox and would map to `ANY_CRM`, but it
  runs no `attachTenant` — authorization is done inside
  `mailAccount.service.resolveAccount` per request. `requireCapability` with no
  `req.tenant` resolves to the empty capability set and would refuse
  **everyone**, platform staff included. Gating it needs tenant context added
  first.
- `scan.routes.js` belongs to the Sales create page, not purchases, and its
  mobile upload endpoint deliberately runs with no JWT.
- `api_access` (Pro+) has no admin surface at all, and `table_management` /
  `event_booking` / `bar_inventory` (Venue) live in the POS app. Unchanged from
  §1's note; do not "fix" without a product decision.

## 6. DECISION — subscriptions bill on Paystack, orders on Korapay

**Resolved 2026-09-06.** These look like a contradiction and are not.

`services/payment.service.js` switches storefront **order** checkout on
`PAYMENT_GATEWAY` (default `korapay`), and the storefront lists Paystack as
"Coming soon". `services/erm.service.js` bills **subscriptions** on Paystack.
That flag has never governed this file, and should not:

- They are different money flows. Korapay moves shopper → platform for one
  order; ERM moves tenant → platform on a recurring schedule.
- The Korapay integration in this repo implements one-off charges
  (`/charges/initialize`) and nothing else. Recurring plan billing — the entire
  product here — has no counterpart in it.
- `PAYSTACK_SECRET_KEY` is configured alongside `KORAPAY_SECRET_KEY`, and the
  `PAYSTACK_PLAN_*` codes already describe the plans.

So a tenant pays their subscription on Paystack while their customers pay for
drinks on Korapay. If subscriptions ever move, `services/erm.service.js` plus
`verifyPaystackSignature` in `controllers/erm.controller.js` are the whole seam.

New env vars this needs: `PAYSTACK_PLAN_EXTRA_SHOP` and
`PAYSTACK_PLAN_EXTRA_WAREHOUSE` (see `.env.example`).

### Webhook signature

Verified — but it was verifying the wrong bytes. The digest was taken over
`JSON.stringify(req.body)`, a **re-serialisation** of the parsed payload, which
equals what Paystack signed only by luck: any difference in whitespace, unicode
escaping or number formatting yields a different digest. Every webhook would
400 and subscription state would silently stop updating — upgrades never
landing, dunning never clearing.

The router now keeps the buffer on `req.rawBody` and the HMAC-SHA512 is taken
over those bytes, compared with `timingSafeEqual`. A missing
`PAYSTACK_SECRET_KEY` is a hard refusal rather than an HMAC keyed on
`undefined`, which anyone could reproduce.

## 7. Platform staff are exempt

`super_admin` and `admin` have no tenant, so they have no plan. An
unconditional plan gate reads their `undefined` plan as `free_trial` and locks
the platform team out of the modules they administer. **Every** gate — server
middleware, Next middleware, the layout guard, and the nav filters — short-
circuits for platform roles first.
