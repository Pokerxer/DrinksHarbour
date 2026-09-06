# Next goals — after the entitlement notices and limit-coverage session

Written 2026-09-06, at the end of the session that worked through
[`subscription-billing-next-goals.md`](./subscription-billing-next-goals.md).

**Read first:** [`subscription-billing-handoff.md`](./subscription-billing-handoff.md)
(what was done and why), then `server/config/README-plan-entitlements.md`
(the rules — §4a and §5a are new), then memory
`entitlement_notices_and_limit_coverage.md`.

**State of the tree:** everything from the last three sessions is still
**UNCOMMITTED** on `feat/referral-rewards`. Verified baselines as of now —
server `node --test '__tests__/*.test.js'` **2656 pass / 0 fail**; admin
`./node_modules/.bin/tsc --noEmit` **458 normalised headers** (`npx tsc` is a
decoy that exits 0); admin `npx vitest run` **98 files / 1728 tests**.

Goals are ordered. **A is the deploy blocker and has been for three sessions.**

---

## A. Nobody can buy anything, and the webhook has never fired

**This is the same blocker the last two handovers ended on, and it has not
moved because it cannot be moved from inside the repo.** Everything downstream
of it — dunning, add-ons, plan upgrades, the commission rate that depends on
plan — is untested against reality.

`node server/scripts/checkErmBillingConfig.js` reports it. Run it **in the
production backend environment**, not on a laptop; the point is to check the
environment the server actually reads.

Against this repo's `.env`: **all seven `PAYSTACK_PLAN_*` codes are unset**, and
`PAYSTACK_SECRET_KEY` is a `sk_test_` key. So `POST /api/erm/subscribe` fails
for every plan, exactly as `POST /api/erm/add-ons` does — the last handover
framed this as an add-ons problem and it is not.

**Do this, in order:**

1. Create seven plans in the Paystack dashboard at the sold prices: Starter
   ₦15,000, Growth ₦35,000, Pro ₦65,000, Enterprise ₦85,000, Venue ₦150,000,
   extra shop ₦12,000, extra warehouse ₦20,000. Set the codes on the
   **production backend**, then re-run the script with `--verify-remote` — it
   checks each code exists and is priced as the pricing page claims.
2. Register `/api/erm/webhook` at dashboard.paystack.com → Settings → API Keys &
   Webhooks. **Paystack exposes no API to read this back**, so it has to be
   confirmed by eye. Nothing in the repo can do it and no script will.
3. Confirm `PAYSTACK_SECRET_KEY` is set on the production backend.
   `verifyPaystackSignature` refuses outright when it is missing, so an unset
   key means every webhook 400s and subscription state silently stops updating.
   Precedent: memory `korapay_redirect_url_outage` — one missing prod env var on
   this exact surface has already caused one outage.
4. **Then drive one real transaction in test mode end to end** and watch the
   tenant document change. The HMAC fix was proven against a synthetic
   pretty-printed payload through a real Express stack; it has never been proven
   against a payload Paystack actually signed. Those are not the same claim.
   Check in order: `subscription.create` writes `paystackSubscriptionCode` and
   **clears `trialEndsAt`**; `charge.success` advances `currentPeriodEnd` only
   on a real `next_payment_date`; `invoice.payment_failed` writes `past_due`;
   an **add-on's** failed invoice does *not* put the tenant into dunning.

**Done when:** the seven codes are set in production and verified remotely, the
webhook URL has been seen in the dashboard, and one test subscription has
visibly moved a tenant document through at least `subscription.create` and
`invoice.payment_failed`.

---

## B. The read-only experience has never been seen in a browser

The toast, the banner and the server copy are pinned by 27 unit tests and by
`tsc`. **No rendered page has been looked at.** The seam is a `window.fetch`
wrapper installed from the root layout — a class of change that unit tests
cannot fully speak for.

Playwright **is** installed on this Mac (`playwright` 1.60 for `python3`,
chromium already cached — see memory `conventions_and_gotchas`; the recurring
"no Playwright here" note is false). The admin's middleware uses an explicit
path-list matcher, so a temp route outside it renders a gated component with no
login.

- Put a tenant into each read-only state in a scratch DB (`past_due`, and
  `trialing` with an elapsed `trialEndsAt`) and confirm: the banner appears
  above the shell on an ordinary screen, a save button produces **one** toast
  and not five, the toast's link reaches `/settings/billing`, and the billing
  page's own amber box still reads correctly.
- Confirm the wrapper is inert for everyone else: a 403 that is *not* a billing
  refusal (`You do not have access to this tenant`) must produce no toast, and a
  200 must not be cloned or read.

**Fix while you are there — a deploy-ordering hole I introduced.**
`app/shared/erm/billing-page.tsx` now renders `{status.entitlementMessage}`
instead of composing the sentence itself. That field is **new**. If the admin
client deploys before the API does, a read-only tenant sees an **empty amber
box** — worse than the wrong wording it replaced. `ReadOnlyBanner` degrades
safely (null message renders nothing); the billing page does not. Either give
the billing page a fallback for a missing field, or make the API deploy a stated
precondition of the client deploy. Do not leave it implicit.

**Done when:** each read-only state has been seen rendered, the non-billing 403
has been seen producing nothing, and the empty-amber-box case cannot happen.

---

## C. The limits count rows that should not count

Three sold limits count the wrong set, all in the same direction — **against the
tenant**. Verified by reading the models and the gates on 2026-09-06; none of
these is speculative, but none has been reproduced against live data either.

| Gate | Counts | Problem |
|---|---|---|
| `checkSkuLimit` | `SubProduct.countDocuments({ tenant })` | No status filter. `SubProduct.status` includes `archived` and `discontinued`, and `PATCH /api/subproducts/:id/archive` is a route a tenant uses — **archiving a product does not free a SKU slot.** |
| `checkStaffLimit` | `User.countDocuments({ tenant, role: {$in: [...]} })` | No status filter. `User.status` includes `suspended`, `inactive` and `deleted` — **a suspended or soft-deleted staff member still occupies a plan seat.** On Starter (`staffLimit: 1`) that is the difference between being able to replace someone and not. |
| `checkWarehouseLimit` | `Warehouse.countDocuments({ tenant })` | No `isActive` filter — but `checkShopLimit` **does** filter `active !== false`. The two halves of the same ₦12k/₦20k add-on pair disagree about whether deactivating frees the slot. |

This is a **product decision before it is a code change**: "does an archived SKU
count against your plan?" is a pricing question, and both answers are
defensible (storage costs something; a tenant who archives to make room and
finds it did not is a support ticket). Decide it once, write it into README §5,
then make all three gates agree.

**Two things the fix must not break:**

- `GET /api/erm/status` reports the same numbers the middleware enforces, on
  purpose — `addOnAllowance` exists so the billing screen cannot promise a slot
  the gate then refuses. Change the count in one place and the screen starts
  lying. `erm.controller.js`'s `getStatus` computes `warehouseCount` and
  `shopCount` itself; those must move with the gates.
- `Warehouse` has an index on `{ tenant: 1, isActive: 1 }` and `SubProduct`'s
  `{ tenant: 1, status: 1 }` index is **commented out** (`models/SubProduct.js`
  ~line 725). A filtered SKU count without it is a collection scan on every
  create.

**Also decide:** `ufg-legacy-limited` sits on `plan: 'free_trial'` with
`subscriptionStatus: 'active'` and no `currentPeriodEnd` — writable, never
degrades, free-trial capability set. Coherent, but it is what you get when
someone is marked active without being sold a plan, and it is now the state that
decides whether they can reach `/api/vendors`. Either correct the record or
write down that free_trial + active is a legitimate comped tier.

**Done when:** the counting rule is written in README §5, all three gates and
`getStatus` follow it, and the index situation is deliberate.

---

## D. A tenant finds out they have lapsed by clicking Save

This is the gap the last session's work exposes rather than closes. A tenant now
gets a clear explanation **at the moment they try to write** — and that is still
the first they hear of it.

Nothing emails anyone. There is no trial-ending warning, no payment-failed
notice, no read-only notice. `TRIAL_DAYS` is 14 and a trial expires silently at
whatever second `trialEndsAt` passes. `invoice.payment_failed` writes `past_due`
and tells nobody. For a subscription business that is the churn hole, not a
polish item.

- Trial: warn before it ends, not after. The data exists (`trialEndsAt` is
  populated on every creation path now) and nothing reads it on a schedule.
- Dunning: send on `invoice.payment_failed`, and again if it is still `past_due`
  some days later. The webhook is the natural hook and it already branches
  add-on failures away from tenant failures — **an add-on's failed invoice must
  not send a "your account is read-only" email**, for the same reason it must
  not set `past_due`.
- Reuse the server's `readOnlyMessage` for the body. That function exists so
  there is one wording; a fourth copy in an email template undoes it.

Check `server/scripts/buildEmailSuppressionList.js` and the existing mail
service before building anything — and note memory `order_email_prod_outage`:
prod SMTP has failed 535 before while dev-mode sends logged "✅". An unverified
"we sent it" is worth nothing here.

**Done when:** an expiring trial and a failed payment each produce a real email
in a real environment, verified by delivery and not by a log line.

---

## E. Every admin page load now costs an extra `/api/erm/status`

`app/layout.tsx` fetches it server-side on every render to drive the read-only
banner. `getStatus` runs **four `countDocuments`** plus the tenant read. That is
a real cost on every page, paid by every tenant, to render nothing at all in the
overwhelmingly common case.

Options, cheapest first: cache it briefly (it changes on a webhook, not per
click); derive `writesAllowed` from the tenant document the layout **already
fetches** and keep only the sentence server-side; or drop the banner and rely on
the toast, which meets the original requirement on its own.

The trap: deriving `writesAllowed` on the client means mirroring
`resolveEntitlements` — and if you also mirror the wording you have undone §B's
single source. Mirror the predicate if you must; never the copy.

**Done when:** the cost is measured and either accepted with a number attached
or removed.

---

## F. Commit it

Three sessions of work — roughly 1,700 changed lines across 41 tracked files
plus new ones — sit uncommitted on a branch already carrying 33 commits about
referrals, categories, brands, chat and cart.

- A 10-commit split is written out in
  [`subscription-billing-handoff.md`](./subscription-billing-handoff.md).
- Cut a new branch from the current HEAD (`feat/plan-entitlements-billing`)
  rather than adding a fifth unrelated theme. `main` is not behind.
- **Do not `git add -A`.** Untracked seed scripts, `server/scripts/seed-output/`,
  `docs/ads/`, `docs/memory/` and `docs/partnerships/` belong to other
  workstreams. Stage the listed paths explicitly.
- The `.env` backups **are** gitignored now (`**/.env.*` with exceptions) —
  that was fixed this session, but re-run `git check-ignore -v` before staging
  anyway. It cost nothing to check and it was wrong for a long time.

**Do not commit or push without being asked in that same turn** (project rule).

---

## Deliberately NOT next

Carried forward and re-verified this session. Do not rebuild working code.

- **Do not rebuild `/api/erm`.** `GET /plans`, `POST /webhook`, `GET /status`,
  `POST /subscribe`, `POST /cancel`, `POST /add-ons`,
  `DELETE /add-ons/:addOnType`, `POST /admin/sync-commission` all exist and are
  tested.
- **Do not move subscriptions to Korapay.** README §6.
- **Do not re-tighten `past_due` to a full lockout.** README §4 — `/api/erm`
  sits behind `requireTenant`, so a lockout also shuts the page needed to pay.
- **Do not re-add `express.raw()` to the webhook route.** It cannot work; the
  bytes come from the global `express.json()` `verify` hook.
- **Do not add `requireCapability` to the POS or inventory routers.** Every one
  of the seven plans holds `ANY_POS` and `inventory`, so the gate could never
  refuse anybody. README §5a.
- **Do not "fix" the other gaps in README §5a** — `/:id/transfer`'s destination
  tenant, `mail.routes.js` (no `attachTenant`, so a capability gate there would
  refuse *everyone* including platform staff), the five `legacyMinPlan` routes,
  and `api_access` with no admin surface. Each has a reason written next to it.
- **Do not reintroduce hand-written read-only copy.** It lived in three places
  and had already drifted; `readOnlyMessage` in
  `server/services/entitlements.service.js` is the one source, and
  `entitlementNotices.test.js` fails if a second appears.
