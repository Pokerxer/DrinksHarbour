# Next goals — the ERM as a product: what the tiers sell vs. what is built

> **STATUS 2026-09-06 (execution session).** Goals worked this session:
> **E** — DONE: `checkStaffLimit` + `countUsage` now exclude `status:'deleted'`,
> so a Starter tenant can replace a removed staff member; README §5 updated;
> 2697 server tests pass. **F1** — DONE: `auditCommissionRates.js` re-ran; both
> live tenants are markup-model → commission field unused; the real finding is
> `wyncity` = enterprise + active + no currentPeriodEnd → free comped tenant,
> recorded in README §4a. **F2** — DONE: wyncity comped/demo decision written
> into §4a; no commission sync action taken. **B** — DONE: cron gate verified
> (`server.js:460`, `billingNotices.job.js` `cron('0 9 * * *')`, `TRIAL_WARNING_DAYS=3`);
> prod-checklist written into §B. **C2** — PARTIAL: server booking module
> landed (Model + service state-machine + controller + `requireCapability('table_management')`
> route with 11 green tests; wired at `/api/bookings`); admin POS dashboard,
> platform venue discover and the checkout 9% commission loop are the next
> subsystems in C2. **A / deploy** — unchanged (Paystack dashboard + Vercel/GitHub
> access still required). Nothing committed/pushed in this session.

**Read first, in order:**
1. `server/config/README-plan-entitlements.md` — the rules; §5 records the
   staff-seat dead end and the deliberately-absent gates; §5a names `api_access`
   and the Venue capabilities as "sold, no surface to gate".
2. `server/config/erm-plans.js` and
   `client/apps/platform/src/app/vendors/register/data.ts` — what is sold.
3. `client/apps/admin/src/config/plan-capabilities.ts` — the route map and the
   "DELIBERATELY UNGATED" / "NO ROUTE YET" notes.
4. The billing chain: `docs/subscription-billing-handoff.md`, `-next-goals.md`,
   `-2.md`, `-3.md` — the state they carried, and goals-3 A/D which this doc
   inherits as its precondition.
5. Memory `goals3_execution.md`, `subscription_state_billing.md`,
   `entitlement_notices_and_limit_coverage.md`.

**State of the tree (verified 2026-09-06):** `feat/plan-entitlements-billing`
@ `c477e1b6`, with the seed/chatbot/email-suppression/banner/docs workstreams
now committed too. Working tree **clean**. Baselines: server
`node --test '__tests__/*.test.js'` **2685 / 0 fail**; admin
`./node_modules/.bin/tsc --noEmit` signature unchanged; admin `npx vitest run`
**98 files / 1728**. Nothing pushes after `feat/plan-entitlements-billing`
@ `cd50c5d1` (goal-3 D: the commits after that are local only).

**The governing fact.** The ERM's paid value is **claims on a pricing page**,
and three of the biggest claims are not built at all:

| Sold (PLAN_TIERS / capability) | Where it lives today |
|---|---|
| Venue tier, ₦150K/mo: *Real-time POS, Table management, Guest CRM, Event booking, Bar inventory* (+ 9% commission, multi-location) | **Nothing.** `table_management`, `event_booking`, `bar_inventory`, `guest_crm` appear in exactly three places: `erm-plans.js`, the capability union, and the pricing tables. No route, controller, service, admin page, or POS page anywhere. The route-map comment claims they "live in the POS app" — that app has no venue code (verified by repo-wide search). |
| *API access* (Pro, ₦65K) | `api_access` is in the capability table and the pricing card. No API-keys screen, no server surface, no way to mint a key. README §5a: "no admin surface". |
| Enterprise tier (₦85K): *Custom integrations, Priority support, Dedicated manager* | Capabilities named, nothing to gate — support/CRM wholesale. Custom integrations is a pipeline to nowhere. |
| *Basic CRM* (Growth) / *Advanced CRM* (Enterprise) | Real cap + routes (`/support`, `/contacts`). Built. |
| Every subscription includes "invoicing, analytics, purchasing, warehouse, POS" | Substantially built (`sales`, `accounting`, `purchase`, `inventory`, `warehouse`, `pos` routes exist). |

And the one paying tenant, `wyncity` (`enterprise`, `active`), has **no
`currentPeriodEnd`** — a free enterprise tier. Revenue from the platform's own
ERM is currently **₦0/month**, gated by goals-3 A/D.

Goals are ordered. **A is the revenue precondition and is date-bound: it can
only be closed by someone with the Paystack and Vercel/GitHub dashboards.**

---

## A. The revenue precondition — buy it, deploy it (carried from goals-3)

Two goals-3 blockers, still open, still the gate for everything below:

1. **Paystack ops** (`docs/subscription-billing-next-goals-3.md` §A): create the
   seven plans at sold prices, set `PAYSTACK_PLAN_*` on the **production
   backend**, register `/api/erm/webhook` (by eye — no read-back API), confirm a
   live key, then drive one real test transaction through
   `subscription.create` and `invoice.payment_failed`. `checkErmBillingConfig.js
   --verify-remote` is the exit sign.
2. **Deploy** (goal-3 §D): the branch — 50+ commits of billing/entitlements,
   seed, chatbot, email-suppression, banner work — reaches production as server
   + admin + platform together (merge to `main`; the deploy-ordering safety net
   from goal-3 B already exists, so either cut order renders correctly).

**Done when:** a tenant has actually paid ₦15K+ via Paystack, the webhook moved
their tenant document, and the admin+server+platform are running the shipped
code against live data.

**Why it is the top of this doc even though it is ops:** until A closes,
the ERM is free software with a pricing page. The Venue/API goals below are
real work, but they are revenue features of a product nobody can buy.

---

## B. The 2026-09-17/09-20 lifecycle — the first real trial, watched

`ufg-legacy-limited` (free_trial) lapses **2026-09-20T10:20:52Z**, per the
goal-3 C decision ("lapse + observe", written in README §4a). The observation
is now a dated milestone less than two weeks out:

- **~09-17** the daily 09:00 `billingNotices` sweep sends the trial-ending
  warning to `admin@ufglegacy.com` (owner verified active on 09-06; the sweep
  runs in production via the `NODE_ENV==='production'` gate at `server.js:460`).
  **Verify the cron actually runs in the production environment** — "wired" is
  not "running". If it does not, that is the first lesson this exercise is for.
- **09-20** `trialEndsAt` passes → `writesAllowed` flips `false`; the standing
  banner, the save-block toast and the `trial_ended` email are the first live
  exercise of the read-only surface on a real tenant.
- If the webhook goal (A) is still open on the 20th, **the tenant cannot pay**
  and the observation becomes a stranded-trial test. Record which it was in §4a.

**Done when:** the warning email reached the owner before the 20th (message ID,
not a log line), the tenant went read-only on schedule with the banner/toast
correct, and a one-line note in §4a says what the tenant did next.

**Already verified in code (2026-09-06):** the sweep is `cron.schedule('0 9 * * *')`
in `jobs/billingNotices.job.js`; `TRIAL_WARNING_DAYS = 3` means the warning can
only fire 2026-09-17 (trial ends 2026-09-20T10:20:52Z); it starts under the same
gate as the other five crons at `server.js:460`
(`ENABLE_CRON === 'true' || NODE_ENV === 'production'`). The **production
check** that only someone with prod server access can make, before the 17th:

1. Confirm `NODE_ENV=production` (or `ENABLE_CRON=true`) on the prod host(s).
2. Confirm the `📬 Billing notices scheduled (daily 09:00 …)` banner appears in
   the prod boot log.
3. Contrived check: call `GET /api/erm/status` for `ufg-legacy-limited` and
   confirm `trialEndsAt` + `daysLeft: 3` shape (proves the helper math).
4. On the 17th: look for the send in the prod logs. A returned **message ID**
   is the pass signal — `dev-mode`/`suppressed` is a fail.

---

## C. Venue tier — stop selling nothing, or ship the first venue slice

The tier is sold at the top price (₦150K) and has **zero implementation**:
table management, guest CRM, event booking, bar inventory, real-time bar POS,
the venue discover section, 9% table-service commission — none exist as routes
or screens. A Venue tenant paying ₦150K would receive Pro minus multi-location,
i.e. the current highest-lying claim on the pricing page.

The business-plan framing (revenue stream 5: clubs & lounges, 9% on table
service) is a multi-part build. So split the decision from the build:

- **C1 (decision — write it in README §5a and on the pricing page).** Either
  (a) scope the **minimum sellable venue slice** and build it, or (b) pull the
  Venue tier's four capability rows off `PLAN_TIERS` and `FEATURE_COMPARISON`
  until built — a tier must never sell a feature that is only a name. Recommended
  minimum slice: **venue discover + table booking with guest-list capture**
  (booking state machine on the contact-customer, a booking dashboard in the
  POS app, the 9% route commission mirrored in checkout) — because that is the
  slice with an order-and-revenue loop, not just a booking ledger.
- **C2 (build, TDD — after C1).** Tenant-scoped booking models, `booking` routes
  with `requireCapability('table_management' | 'event_booking')` server gates,
  the venue screens, and the discover section on the platform app. All the
  tenant-isolation + plan-gating machinery exists and is tested; this is feature
  work on top of it, one committed unit per subsystem, mirroring how
  `sub-sales` phase 2 was split.

**Done when:** either the Venue tier has a live table-booking loop (book →
      accept → fulfil → 9% commission on a paid order) exercised end-to-end, or
      the pricing page no longer lists a venue feature that is not built.

---

## D. API access (Pro+) — a real surface, or stop listing it

`api_access` is sold on the Pro, Enterprise and Venue cards; there is no way to
mint a key. The admin app has only `/settings/billing` and the settings index
(route map comment: no API-keys screen anywhere).

When it lands, the building blocks already exist: `verifyApiKey`-style auth is a
pattern, the per-endpoint rate limiters + `concurrencyGuard.middleware.js` from
the chatbot work generalize to keyed traffic, and the tenant-acl middleware
needs no change (a key is a tenant credential). The surface is:

- **Server:** `apiKey` model per tenant (hash the key, never store plaintext —
  the `RefreshToken` hashing pattern is the precedent), `POST/DELETE
  /api/erm/keys`, a scoped `verifyApiKey` middleware that reads the key's tenant
  and revokes on tenant suspension, per-key rate limits.
- **Admin:** an `/settings/api` screen gated on `api_access` in
  `ROUTE_CAPABILITIES` (the route map already reserved the slot), key mint /
  revoke, last-used + scope display.
- **Industry-standard key hygiene:** one-time plaintext display at mint, no
  listing of live keys, hygiene identical to what a tenant would expect from
  the ERM's own competitor SaaS.

**Done when:** a Pro+ tenant can mint a scoped key in the admin, call one
resource with it (`Authorization: Bearer`), revoke it, and — after tenant
suspension — the key stops working. Keys are hashed at rest.

---

## E. Close the staff-seat trap (README §5)

**DONE (2026-09-06).** `checkStaffLimit` (plan.middleware.js) and `countUsage`
(ermUsage.service.js) now both exclude `status: 'deleted'`, so a Starter
tenant who removes their only staff member can add a replacement. The counting
test was rewritten to pin the new query shape, and a dedicated gate test proves
the starter-seat reuse path; 2697 tests pass. README §5 now records the chosen
fix (exclude deleted, do not add hard-delete) and why it was chosen.

---

## F. Commission is charged but never verified

**F1 and F2 DONE (2026-09-06).** `auditCommissionRates.js` runs read-only
against live data, flags only commission-model mismatches, and reports the
operative field for markup tenants so it cannot mislead again.

Live-data finding: `wyncity` is `enterprise / active / markup` with
`commissionPercentage: 0` and **no currentPeriodEnd** — the commission field is
unused (the tenant uses the markup revenue model), but the subscription leak is
real: a paid-config tenant providing ₦0. Decision recorded in README §4a:
leave wyncity exactly as-is (**comped/demo tenant for now**), do not "fix" it
by running `POST /admin/sync-commission`.

Reachable once A is live: run the audit in production, sync only where the
mismatch is stale (not a deliberate manual override), and add the checkout
commission-split assertion to the order test.

**Done when:** the audit reports zero plan-vs-rate mismatches for
commission-model tenants, the checkout split for a marketplace order matches the
tenant's `commissionRate` in a test, and `wyncity`'s comped status is
deliberate and written.

---

## Deliberately NOT next

Carried forward, do not rebuild:

- **Do not re-tighten `past_due` to a lockout** (§4) and **do not move
  subscriptions off Paystack** (§6). The survivable read-only design is settled.
- **Do not gate the five `legacyMinPlan` routes with invented capabilities**
  (§5a) — that would mean inventing pricing. Their thresholds stay as-recorded.
- **Do not touch the deliberately ungated surfaces** (`/products`,
  `/settings`, catalogue/account routes) — gauges exist to keep tenants able to
  pay.
- **Do not reimplement `readOnlyMessage`** anywhere (email/403/toast/billing
  page share one copy; `entitlementNotices.test.js` pins it).
- **Do not re-add `express.raw()`** on the webhook route; the JSON
  `verify`-hook byte-capture is proven.
- **Do not build the Venue tier "in one commit".** A feature of its size is
  subsystems (booking, guest list, bar inventory, discover, commission), each a
  committed unit — the sub-sales phase 2 pattern.
- **Do not ship an API-keys screen storing plaintext keys.** Keys are hashed at
  rest or not shipped (RefreshToken is the precedent).
- Branch hygiene stands: this tree was swept clean *once* under explicit
  instruction; future workstreams stay on their own branches, and nothing pushes
  without being asked in the same turn.