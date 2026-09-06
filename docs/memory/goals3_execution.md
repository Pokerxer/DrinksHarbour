---
name: goals3_execution
description: 2026-09-06 execution of subscription-billing-next-goals-3.md — branch pushed, billing-notice delivery proven against real SMTP, ufg-legacy-limited lapse decision recorded, remaining blockers (Paystack dashboard, Vercel deploy).
type: memory
---

# Goals 3 execution — what closed and what is still blocked

Ran `docs/subscription-billing-next-goals-3.md` A–D on 2026-09-06. Baselines
verified first: server **2685 pass / 0 fail**, admin vitest **98 files / 1728**,
tsc signature unchanged. `.env` points at the **production** DB
(`/drinksharbour`), email ON, cron dev-off.

## Closed this session

- **D (push):** `feat/plan-entitlements-billing` pushed to `origin` (Pokerxer/
  DrinksHarbour), upstream set, 44 commits ahead of `main`. The 10-commit
  entitlement/billing corpus is now on GitHub. **Nothing else was pushed.**
- **B (delivery):** new one-shot
  `server/scripts/proveBillingNoticeDelivery.js --to <addr>` sends both
  subscription notices through the **real** SMTP transport
  (`premium356.web-hosting.com:465`, from `orders@drinksharbour.com`) with an
  injected no-op `stamp` — exercises templates + transport + `readOnlyMessage`
  copy, writes NOTHING to the DB. Proof run to `heroogene@gmail.com` returned
  real message IDs `<75b5fa32-d1db-3d70-edec-536216d61c1d@drinksharbour.com>`
  (trial-ending) and `<8ef3024b-9e95-4e86-167e-abbcaa8989f7@drinksharbour.com>`
  (payment-failed). It FAILS (exit 1) on `messageId: dev-mode` / `suppressed`,
  so "a log line" never passes for delivery.
- **C (decision):** `ufg-legacy-limited` **lapses 2026-09-20 and is observed**,
  not extended — written into `README-plan-entitlements.md` §4a. Fact verified
  by direct read: `contactEmail` is empty, so the notices resolve to the
  tenant_owner **`admin@ufglegacy.com`** (active) — the 09-17 warning is not dead
  letter. Watch the sweep fire ~09-17, `trialEndsAt` flip on 09-20, and the
  banner/toast/`trial_ended` email on the first live tenant.

## Still blocked (external access, cannot close in-repo)

- **A (Paystack):** `checkErmBillingConfig.js` re-confirmed — all seven
  `PAYSTACK_PLAN_*` unset, `PAYSTACK_SECRET_KEY` is `sk_test_`. Needs: create
  the 7 plans in the Paystack dashboard at sold prices, set codes on the
  **production backend**, register `/api/erm/webhook` by eye (no read-back API),
  then drive one real test transaction.
- **D (deploy):** no `vercel` CLI and no `gh` CLI on this machine → cannot
  deploy or inspect Vercel/GitHub builds from here. The pushed branch will
  produce preview builds only if the Vercel GitHub integration picks it up; the
  production deploy is a merge to `main` + the admin/platform projects building.

## House-rule reminder this session proved again

On this box `npx tsc` is a decoy; `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit`
is the gate. `cd server && node --test '__tests__/*.test.js'` — sanity-check the
**count** (`# tests` ~2685), not the failure number. Never `git add -A` — the
seed/chatbot/banner/`docs/*` workstreams stay untracked where they belong.
New files this session are uncommitted: the proof script and this memory entry.