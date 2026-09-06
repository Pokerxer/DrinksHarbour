# Next goals — after the usage cache, the counting rule, and the commits

> **STATUS 2026-09-06 (execution session).** Goals worked in this session:
> **D** — branch pushed: `feat/plan-entitlements-billing` → `origin`
> (`https://github.com/Pokerxer/DrinksHarbour`, upstream set). **A** — state
> re-confirmed by `checkErmBillingConfig.js`: all seven `PAYSTACK_PLAN_*` codes
> unset, `PAYSTACK_SECRET_KEY` a test key → dashboard access still required.
> **B** — DELIVERY PROVEN: `scripts/proveBillingNoticeDelivery.js` sent both
> notices through the real SMTP transport (`premium356.web-hosting.com:465`),
> real message IDs `<75b5fa32…@drinksharbour.com>` (trial-ending) and
> `<8ef3024b…@drinksharbour.com>` (payment-failed) to `heroogene@gmail.com`; no
> DB writes (injected no-op stamp); cron gate confirmed at `server.js:460`.
> **C** — DECIDED: `ufg-legacy-limited` lapses 2026-09-20 and is observed, not
> extended; decision written into `README-plan-entitlements.md` §4a. Nothing
> committed/pushed beyond the branch push itself — the new proof script and this
> update are uncommitted.

Written 2026-09-06, at the end of the session that closed `-2.md` goals C, E and F
and the last `-2.md`-forward item from the second session of the handoff.

**Read first:** [`subscription-billing-handoff.md`](./subscription-billing-handoff.md)
(what was done, the commit split), then `server/config/README-plan-entitlements.md`
(§4/§4a — the dunning decision; §4b — billing config is environment state; §5/§5a
— the counting rule and every door a limit is behind; §5b — the usage cache),
then memory `subscription_state_billing.md` and `entitlement_notices_and_limit_coverage.md`.

**State of the tree (verified 2026-09-06):** the full entitlement/billing corpus —
10 commits from the handoff plus the billing notices, usage cache and their
tests — is on **`feat/plan-entitlements-billing` @ `cd50c5d1`**, **44 commits
ahead of `origin/main`, no upstream, nothing pushed**. `main` is `6bde3e37`
(ahead 1 of `origin/main`, unrelated cart fix). `git status` is clean except the
long-standing **untracked** workstreams that are deliberately not staged (seed
migration, chatbot rate limits, email suppression, platform banner analytics,
`docs/memory/`, `docs/ads/`, `docs/partnerships/`) — **never `git add -A`**.
Baselines: server `node --test '__tests__/*.test.js'` **2685 pass / 0 fail**;
admin `./node_modules/.bin/tsc --noEmit` no new headers; admin `npx vitest run`
**98 files / 1728 tests**.

Status of `-2.md` goals A–F:

| Goal | Status |
|---|---|
| A. Paystack ops — plans, webhook, live key | **STILL OPEN.** Nothing in-repo can close it. All seven `PAYSTACK_PLAN_*` unset, key is `sk_test_`, webhook unseen. **Still the deploy blocker.** |
| B. Read-only experience in a browser | **DONE** — banner, toast dedup, non-billing-403 inertness all seen. Deploy-ordering hole closed (billing page has a fallback for a not-yet-shipped `entitlementMessage`). |
| C. Limits counting the wrong rows | **DONE** — README §5: *every row counts; deactivating frees nothing; delete is the way out.* Only `checkShopLimit` moved. The staff no-hard-delete dead end is recorded, not patched. |
| D. Tenants find out before they click Save | **CODE DONE, DELIVERY UNVERIFIED.** Banner + toast + one copy. The two emails (trial-ending, dunning follow-up) are built and committed; **no real email has been proven delivered**. See goal B below. |
| E. Every page load pays for four `countDocuments` | **DONE** — README §5b. Measured ~125 ms/load; the three counts are cached (45 s TTL); the entitlement decision is not. Invalidation lives in the gates, nowhere else. |
| F. Commit it | **DONE** — 10 explicit-path commits on the new branch. Nothing pushed. |

Goals are ordered. **A is the deploy blocker and has been for four sessions.**

---

## A. Nobody can buy anything, and the webhook has never fired

Unchanged from `-2.md` §A and still open, because it cannot be moved from inside
the repo. **One new timebox makes it urgent:** `ufg-legacy-limited`'s trial ends
**2026-09-20**. If the plans do not exist and the webhook is not registered
before then, that tenant cannot pay and will go read-only on a date.

`node server/scripts/checkErmBillingConfig.js` reports it. Run it **in the
production backend environment** — the point is the environment the server reads,
not a laptop. Against this repo's `.env`: **all seven `PAYSTACK_PLAN_*` codes are
unset** and `PAYSTACK_SECRET_KEY` is a `sk_test_` key, so `POST /api/erm/subscribe`
fails for every plan, exactly as `POST /api/erm/add-ons` does.

**Do this, in order:**

1. Create seven plans in the Paystack dashboard at the sold prices: Starter
   ₦15,000, Growth ₦35,000, Pro ₦65,000, Enterprise ₦85,000, Venue ₦150,000,
   extra shop ₦12,000, extra warehouse ₦20,000. Set the codes on the
   **production backend**, then re-run the script with `--verify-remote` — it
   asks Paystack whether each code exists and is priced as the pricing page
   claims.
2. Register `/api/erm/webhook` at dashboard.paystack.com → Settings → API Keys
   & Webhooks. **Paystack exposes no API to read this back**; confirm by eye.
3. Confirm `PAYSTACK_SECRET_KEY` is set on the production backend
   (`sk_live_`). `verifyPaystackSignature` refuses outright when it is missing,
   so an unset key makes every webhook 400 and subscription state silently stops
   moving. Precedent: memory `korapay_redirect_url_outage`.
4. **Then drive one real transaction in test mode end to end** and watch the
   tenant document change. The HMAC was proven against a synthetic payload
   through a real Express stack; it has never been proven against bytes Paystack
   actually signed. Check in order: `subscription.create` writes
   `paystackSubscriptionCode` and clears `trialEndsAt`; `charge.success` advances
   `currentPeriodEnd` only on a real `next_payment_date`;
   `invoice.payment_failed` writes `past_due`; an **add-on's** failed invoice does
   *not* put the tenant into dunning (that decision is `addOnTypeForEvent`,
   `erm.service.js` — deliberately tested, never exercised against live events).

**Done when:** the seven codes are set in production and verified remotely, the
webhook URL has been seen in the dashboard, and one test subscription has visibly
moved a tenant document through `subscription.create` and
`invoice.payment_failed`.

---

## B. Deliver a real email

The `-2.md` §D *done-when* — "an expiring trial and a failed payment each produce
a real email in a real environment, verified by delivery and not by a log line" —
is the one part of goal D that is still open. The code is committed:

- `services/billingNotifications.service.js` — pure, tested, and every body
  sentence comes from `readOnlyMessage` so the email, the 403, the toast and the
  billing page say one thing. Idempotence is stamped on `billingNotices.*` so a
  warning is not re-sent for the same `trialEndsAt`.
- `jobs/billingNotices.job.js` — the daily 09:00 sweep. Wired in
  `server.js:460`, gated on `ENABLE_CRON === 'true' || NODE_ENV === 'production'`,
  so it starts in production automatically; in dev it needs `ENABLE_CRON=true`.
  **Check that gate on the box that runs the job** — "we wired it" is not "it
  runs".
- The first `invoice.payment_failed` email comes from the webhook itself
  (`erm.service.js`), not the sweep — so this notice is also gated on goal A's
  webhook actually existing.

**Prove both paths against a real SMTP transport**, remembering memory
`order_email_prod_outage`: prod SMTP has failed 535 before while dev-mode logs
"✅". A message-ID from the transport is the minimum evidence; a log line is not.
Use a scratch tenant (or `ufg-legacy-limited` with `+2h` on `trialEndsAt`, then
revert) rather than mailing the live tenant twice. Watch for the two hazards the
sweep must not hit: an add-on's failed invoice must NEVER send the tenant-level
"your account is read-only" email, and a re-sent notice must not double-send
(`trialEndingSentFor` vs `pastDueSentAt`).

**Done when:** both email types are seen in a real mailbox with a returned
message ID, the cron gate is confirmed on the target environment, and a repeat
sweep sends nothing the second time.

---

## C. The 2026-09-20 trial lease on `ufg-legacy-limited`

This is the commercial question `-2.md` §D raised as "decide it," now with a date.
`README-plan-entitlements.md` §4a records the live data: **one tenant, a normal
14-day trial ending 2026-09-20**, after which `writesAllowed` flips to `false`
across the admin. The comped D-forever population is gone; this is now a real
trial that will lapse silently if nothing is done. Goal B's trial-ending email
is the answer to "warn first" — the remaining question is **what should happen
on the 20th** and who is responsible for watching it.

Decide and write the decision into §4a, *before* the 20th:

- Convert them (sell them a plan — requires goal A to be live), extend the trial,
  or let them lapse to read-only and observe dunning for the first time against
  a real tenant.
- If "let them lapse": that is the first real live exercise of the read-only
  banner, the toast, and the dunning follow-up email. Schedule the verification,
  and capture the tenant's `subscriptionStatus` + `trialEndsAt` before the date
  so a cold reader can see they lapsed on schedule.

Re-run `node scripts/auditTrialState.js --all` in any environment whose tenant
data was not read on 2026-09-06 before making this call — that cluster's table is
the artefact's output on one day, not a law.

**Done when:** the decision is in §4a with a date on it, and someone has
confirmed what happened on the 20th (subscribed, extended, or observed lapsed
with the notices behaving).

---

## D. Ship it — push the branch and run the lifecycle against production

Four sessions of uncommitted work are now committed but **nowhere**. The
entitlements layer has passed unit tests, a served harness page, and one cluster's
read-only data — it has never been pushed, never deployed, and never run against
production traffic. The branch is 44 commits ahead of `origin/main` with no
upstream. This goal closes `-2.md` F's natural successor: commit was the
milestone, reach-the-deploy is the next one.

- Push `feat/plan-entitlements-billing` and get it deployed as server + admin
  client **together**. The deploy-ordering hole in goal B/the billing page is
  already closed (the page falls back when the API hasn't shipped
  `entitlementMessage` yet), so either order now renders correctly — but "the
  two halves are in production" is the only state that counts, and the old
  client-new API case should never ship first by accident again. `main` is not
  behind, so the cut stays clean if a merge to `main` is preferred; decide once
  and record the decision.
- After deploy, re-run the artefact scripts **in the production environment**,
  not off a laptop: `checkErmBillingConfig.js --verify-remote` (goal A) and
  `auditTrialState.js --all` (§4a's rule: the numbers are one cluster on one day).
- Then let the read-only + usage-cache surfaces see their first live traffic:
  `GET /api/erm/status` p50 against `wyncity`'s 995-SKU catalogue should near
  the 0.01 ms cache-hit number from §5b, the banner/toast should be inert for a
  healthy tenant, and a `past_due` tenant (once one exists, say from goal C)
  should see exactly the states goal B's unit pins.

**Done when:** the branch is pushed, the two halves are live against the same
data, `checkErmBillingConfig` and `auditTrialState` have run green in that
environment, and one real page load has been confirmed (banner correct for the
healthy tenant, one toast when a real billing 403 fires).

---

## Deliberately NOT next

Carried forward and re-verified this session. Do not rebuild working code.

- **Do not rebuild `/api/erm`.** `GET /plans`, `POST /webhook`, `GET /status`,
  `POST /subscribe`, `POST /cancel`, `POST /add-ons`, `DELETE /add-ons/:addOnType`,
  `POST /admin/sync-commission` all exist and are tested.
- **Do not move subscriptions to Korapay.** README §6 — subscriptions bill on
  Paystack, storefront orders on Korapay.
- **Do not re-tighten `past_due` to a full lockout.** README §4 — `/api/erm` sits
  behind `requireTenant`, so a lockout shuts the page needed to pay.
- **Do not re-add `express.raw()` to the webhook route.** The bytes come from the
  global `express.json()` `verify` hook, proven end-to-end.
- **Do not re-split the counting rule across the four limits.** README §5: the
  decision is "count rows; deleting frees a slot", and it was a product decision.
  The only dead end it leaves — staff have no hard delete, so a Starter tenant
  who removes their one staff member can never add a replacement — is recorded at
  the bottom of §5. If it is ever fixed, fix it there (exclude `deleted`, or add
  a real employee delete); do not touch the other three gates.
- **Do not "fix" the deliberately ungated routes in README §5a** — `ANY_POS` /
  `inventory` (every plan holds them), the five `legacyMinPlan` routes,
  `mail.routes.js`, `/:id/transfer`'s destination tenant, `api_access` with no
  admin surface. A reason is written next to each.
- **Do not reintroduce hand-written read-only copy.** `readOnlyMessage` in
  `server/services/entitlements.service.js` is the one source; the email, the
  403, the toast and the billing page all render it. `entitlementNotices.test.js`
  fails if a second copy appears.
- **Do not commit or push without being asked in that same turn** (project rule).
  The 44-commit gap and the untracked orphan workstreams are deliberate; never
  `git add -A`.