# RESUME — Employee badge shows the tenant's shop name

**Date:** 2026-08-17
**Branch:** `feat/mobile-phase-1-foundation`
**Status:** DONE, verified end-to-end, **UNCOMMITTED**

---

## The ask

The printed employee badge said **DRINKSHARBOUR** across its header band. It is a
card printed by a shop, for that shop's own staff, and handed to somebody who
works there — it should say the shop's name.

## What was actually wrong

**Not the badge.** `badge-utils.ts` already did the right thing: `badgeBrand()`
takes `useTenant().tenant?.name` and only falls back to `'DrinksHarbour'` when
there is no tenant in context. That fallback was firing because **there was no
tenant in context**, for almost everybody.

`src/app/layout.tsx` resolved the tenant from **the subdomain alone** — the
`x-tenant-slug` header that `middleware.ts` sets from `<slug>.drinksharbour.com`.
But `middleware.ts:34` lists `admin.drinksharbour.com`, `localhost` and
`127.0.0.1` as `rootHosts` and returns `null` for them. So every tenant user
signing in at **admin.drinksharbour.com** — and every developer on localhost —
got `initialTenant = null`, `isMainSite = true`, and the platform's name and
colour on every branded surface.

The badge was the most visible symptom, not the cause. The sidebar, the header
logo, the dashboard hero and the `--color-tenant-primary` CSS variable were all
falling back the same way.

## The fix

The signed-in user's own tenant is the missing half, and it was already on the
session: `session.user.tenantSlug`, set in `auth-options.ts` from the populated
`user.tenant` (verified: both the `credentials` and `pos-pin` providers return
`tenant.slug`).

- **NEW `src/context/tenant-slug.ts`** — `resolveTenantSlug({hostSlug, sessionTenantSlug})`.
  Subdomain wins, session is the fallback, blank/whitespace counts as absent,
  `null` when neither names a tenant (a platform admin genuinely owns none).
- **NEW `src/context/tenant-slug.test.ts`** — 6 tests.
- **`src/app/layout.tsx`** — calls it instead of reading the header directly.
- **`src/context/TenantContext.tsx`** — comment only. `isMainSite` now means
  "no tenant at all", **not** "no subdomain". Anything reading it as a proxy for
  the subdomain is now wrong.
- **`src/app/shared/employees/badge-utils.ts`** — comment only; the old one
  documented the subdomain-only behaviour.

**No change to the badge component or to `badgeBrand`.** They were already right.

## Why the decision lives in its own file

Admin Vitest runs `environment: 'node'` with no jsdom, so a server component
cannot be rendered under test. The failure mode is silent — a wrong answer here
prints somebody else's shop name on a card, or an empty band, and neither
throws. So the decision is a pure function that can be tested; the layout only
wires it.

## Why the subdomain wins over the session

It is how a platform admin pivots into one tenant. A tenant user who lands on
somebody else's subdomain never reaches this code — `middleware.ts:119-125`
redirects them to `/access-denied` before the layout renders.

## Verification (all done, not assumed)

- **Admin Vitest: 901/901, 50 files.** (Baseline at session start was 857/857 /
  46 files; +6 are mine, +38 arrived from concurrent work — see below.)
- **Admin tsc: `./node_modules/.bin/tsc --noEmit`, source-only, 452 → 460.**
  All 8 new errors are in the concurrent POS-offline / product-form work
  (`offline/image-*.ts`, `use-product-images.tsx`, `pos-order-picker-modal.tsx`,
  `form-utils.ts`) plus TS2367 union-member reordering noise in `purchases-*`.
  **Zero in any file this change touches.**
  (`npx tsc` installs a decoy that exits 0 — use `./node_modules/.bin/tsc`.
  Strip line/col and diff, never count.)
- **End-to-end against the live local stack**, logged in through NextAuth as
  `chukwuma@wyncity.ng` (tenant_owner, Wyn City) on **plain localhost:3000 —
  no subdomain**:
  - `/api/auth/session` → `"tenantSlug":"wyncity"` ✓
  - `GET /employees` SSR HTML → `"Wyn City"` ×2, `--color-tenant-primary:#b51a00` ✓
  - **Counterfactual proven:** with the layout change `git stash`ed, the same
    request returned `"Wyn City"` ×0 and no tenant colour.
  - The 4 remaining `DrinksHarbour` strings are the browser tab `<title>` and
    meta description — the admin *product* name. Correct, out of scope.
- Final hop already covered by existing tests:
  `badgeBrand('Wyn City').headerLine === 'WYN CITY'` (`badge-utils.test.ts:179`).

## Gotchas found, worth keeping

- **The memory entry `wyncity_org_chart_shared_password.md` has the wrong email.**
  It records `okpala.chukwuma.andreas@wyncity.ng`; the account is actually
  **`chukwuma@wyncity.ng`** (password `123456` still works). Corrected in memory.
- **Another process was writing to this working tree during the session**
  (`point-of-sale/offline/image-*.ts`, mtimes 01:59–02:07) — the POS offline
  product-images task. It moved both the test count and the tsc baseline
  underneath this work. Re-measure both before trusting any recorded number.

## Not done / out of scope

- The badge modal itself renders on click, so it is not in the SSR HTML. It was
  verified by proving its input (`useTenant().tenant.name`) is now the shop's
  name and that its output for that input is already tested — not by driving a
  browser.
- `/kiosk/:token` resolves its tenant from the kiosk token, not this path.
  Untouched.
- Nothing committed. Per `CLAUDE.md`, finished work is left uncommitted.
