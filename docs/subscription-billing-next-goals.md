# Next goals — after "make subscription state real"

> **STATUS 2026-09-06 — A, B, C and D worked through. Outcome, corrected
> premises and the proposed commit split are in
> [`subscription-billing-handoff.md`](./subscription-billing-handoff.md).
> Read that before acting on anything below.**
>
> Short version: **A** — 0 tenants affected, nothing to backfill, no commercial
> call needed; the three ops items are still open and need dashboard access.
> **B** — done, but the named seam (`lib/api-client.ts`) was dead code and
> `err.code` was never serialised at all; both fixed. **C** — three unguarded
> SKU-creation doors and five unguarded purchases routers found and closed.
> **D** — the two `.env` backups were **not** gitignored; fixed. Nothing
> committed.

Written 2026-09-06, at the end of the session that built add-ons, `trialEndsAt`,
`checkStaffLimit` and the `past_due` read-only decision.

**Read first:** `server/config/README-plan-entitlements.md` (the rules), then
memory `subscription_state_billing.md` and `plan_based_route_protection.md`.

**State of the tree:** both of those workstreams are **UNCOMMITTED**. Verified
baselines as of now — server `node --test '__tests__/*.test.js'` **2640 pass /
0 fail**; admin `./node_modules/.bin/tsc --noEmit` **459 normalised headers,
diff empty** (`npx tsc` is a decoy that exits 0); admin `npx vitest run`
**97 files / 1709 tests**.

Goals are ordered. **A is a deploy blocker** — everything else can wait, it
cannot.

---

## A. Don't take live tenants read-only by accident

**The problem.** The write gate now works, and it is retroactive. Two
populations flip the moment this deploys:

1. Tenants on `subscriptionStatus: 'trialing'` with a `trialEndsAt` already in
   the past. Previously unrestricted; now **read-only** across the whole admin.
   The README always said this; nothing enforced it, so nobody has been holding
   the data to that rule.
2. Tenants on `trialing` with **no** `trialEndsAt` at all — the old default for
   anything not created through the public vendor form. They stay writable
   (a missing date reads as "never expires"), but the new pre-save hook only
   stamps **new** documents, so they stay permanently free until backfilled.

**Do this before deploying, in order:**

- Write `server/scripts/auditTrialState.js` (one-thing script, `--dry-run` by
  default, following the house style in `server/scripts/`). Report, per tenant:
  `plan`, `subscriptionStatus`, `trialEndsAt`, `currentPeriodEnd`, and whether
  `resolveEntitlements` currently returns `writesAllowed: false`. **Read the
  counts before writing anything.**
- Decide, and write the decision into README §4a: grandfather the elapsed set
  (push `trialEndsAt` forward, or move them to `active`), or let them degrade
  and notify them first. This is a commercial call, not a technical one — put
  the numbers in front of whoever owns it.
- Backfill `trialEndsAt` for the open-ended `trialing` set once the above is
  settled.

**Also blocking, and purely ops — verify, do not assume:**

- `PAYSTACK_PLAN_EXTRA_SHOP` and `PAYSTACK_PLAN_EXTRA_WAREHOUSE` are **new** and
  are not set anywhere yet. Without them `POST /api/erm/add-ons` throws
  `No Paystack plan code configured` — the guard is deliberate (it refuses
  rather than granting a free slot), but the plans must actually be created in
  the Paystack dashboard at ₦12,000 and ₦20,000/mo.
- The `/api/erm/webhook` URL must be registered in the Paystack dashboard. None
  of this state moves without it, and nothing in the repo can confirm it.
- Confirm `PAYSTACK_SECRET_KEY` is set in the **production backend** env, not
  just locally. `verifyPaystackSignature` now refuses outright when it is
  missing (by design — an HMAC keyed on `undefined` is reproducible by anyone),
  so an unset key means every webhook 400s. Note the precedent in memory
  `korapay_redirect_url_outage.md`: a missing prod env var on this exact
  surface has already caused one outage.

**Done when:** the affected-tenant counts are known and recorded, the decision
is in the README, and the three ops items are confirmed set — not assumed.

---

## B. A read-only tenant currently sees a bare 403 on every screen but one

**Verified in-repo:** `grep -rl "SUBSCRIPTION_READ_ONLY\|PLAN_UPGRADE_REQUIRED"
client/apps/admin/src` returns **nothing**. The server raises both codes with a
populated `err.details`; the client understands neither.

So today the only place a lapsed tenant is told what is happening is the banner
on `/settings/billing`. Everywhere else — every save button in the app — throws
an unexplained 403. That is the "billing problem becomes a support incident"
failure the README's §4 rationale is specifically trying to avoid, just moved
one layer out.

**The seam is single:** `client/apps/admin/src/lib/api-client.ts`. Do it there,
not per-screen.

- On `SUBSCRIPTION_READ_ONLY`: a toast naming the reason (`trial_expired` vs
  `subscription_past_due` — the server sends `details.reason`) with a link to
  `/settings/billing`. The copy already exists in
  `middleware/tenant.middleware.js`'s `assertWritesAllowed`; do not invent a
  second wording.
- On `PLAN_UPGRADE_REQUIRED`: `details.upgradeTo` already names the cheapest
  plan that unlocks the capability. Use it — that field exists precisely so the
  client does not have to parse prose.
- Consider disabling write controls up front for a read-only tenant rather than
  letting them fill a form and lose it. `GET /api/erm/status` now returns
  `writesAllowed` and `entitlementReason` for exactly this.

**Trap:** do not gate this on `subscriptionStatus === 'past_due'`. An elapsed
trial is `trialing` and also read-only. Gate on `writesAllowed`.

**Done when:** a read-only tenant gets an explanation and a route to billing
from any screen, and the copy has one source.

---

## C. Audit which limits are actually mounted

`checkStaffLimit` and `checkShopLimit` were both written and mounted nowhere
until this session — that pattern is worth checking for rather than assuming it
was the last instance.

- `checkSkuLimit` is mounted on `server/routes/subproduct.routes.js` only.
  Confirm there is no second path that creates a `SubProduct` (bulk import,
  seed-driven creation, the AI product tooling) which bypasses it. A limit with
  one guarded door and one unguarded door is not a limit.
- `requireCapability` coverage: walk the `(hydrogen)` route groups against
  `ROUTE_CAPABILITIES` in `client/apps/admin/src/config/plan-capabilities.ts`
  and confirm each has a corresponding **server** gate. The client map is a
  mirror, not enforcement.
- Known and deliberate, do not "fix" without a product decision: `api_access`
  is sold on Pro and above with **no admin surface at all** (there is no
  API-keys screen), and `table_management` / `event_booking` / `bar_inventory`
  live in the POS app rather than the admin. Recorded in
  `plan_based_route_protection.md`.

**Done when:** every sold limit has every creation path behind it, or the gap is
written down as intentional.

---

## D. Review and commit two large uncommitted workstreams

Plan-based route protection and subscription state are both sitting
uncommitted, together roughly 1,500 lines across ~23 files. That is a lot of
unreviewed surface on a branch (`feat/referral-rewards`) whose name describes
neither.

- Split into coherent commits rather than one blob — the entitlement layer, the
  subscription/billing layer, and the tests are separately reviewable.
- Consider whether this belongs on `feat/referral-rewards` at all.
- `server/.env.backup-preseed` and `server/.env.seedmode-backup` are untracked
  in the working tree. **Check they are gitignored before any `git add -A`.**

**Do not commit or push without being asked in that same turn** (project rule).

---

## Deliberately NOT next

Recorded so the next session does not rebuild working code — the mistake the
last handover caught:

- **Do not rebuild `/api/erm`.** `GET /plans`, `POST /webhook`, `GET /status`,
  `POST /subscribe`, `POST /cancel`, `POST /add-ons`,
  `DELETE /add-ons/:addOnType` and `POST /admin/sync-commission` all exist and
  are tested.
- **Do not move subscriptions to Korapay.** Settled and reasoned in README §6 —
  subscriptions bill on Paystack, storefront orders on Korapay, and
  `PAYMENT_GATEWAY` governs only the latter.
- **Do not re-tighten `past_due` to a full lockout.** Settled in README §4; the
  reason is that `/api/erm` sits behind `requireTenant`, so a lockout also shuts
  the page the tenant needs in order to pay.
- **Do not re-add `express.raw()` to the webhook route.** It cannot work:
  `express.json()` in `server.js` runs first and sets `req._body`, so a
  route-level raw parser yields no Buffer. The bytes come from that parser's
  `verify` hook, proven end-to-end against a pretty-printed payload.
