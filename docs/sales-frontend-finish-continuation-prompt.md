# Continuation Prompt — Finish `feat/sales-frontend` (merge decision + remaining verification)

> Paste everything below the line into a NEW Claude Code session at the repo root
> (`/Users/mac/Documents/drinksharbour`). It is self-contained. A previous
> session built all of Stage A and a layout redesign on `feat/sales-frontend`
> and stopped at a cost checkpoint right before the merge/PR/keep/discard
> decision — your job is to pick that up.

---

## What's already done (do NOT redo)

**Worktree:** `.claude/worktrees/sales-frontend`, branch `feat/sales-frontend`,
tip `5b61b0bb`, based on `main` at `e078ffcf`. `git status` is clean there.

**Stage A (7 tasks, transactional core: quotations/orders/create/fulfill/returns):**
Built via `superpowers:subagent-driven-development`, every task independently
reviewed clean (spec ✅, quality approved), plus a final whole-branch review
(opus) that found **zero Critical/Important issues** — verdict was "ready to
merge with fixes," where the only required fix was running the manual E2E
flow, not a code change. The 4 trivial unused-import Minor findings from that
review were already swept (commit `2ceb9d00`).

**Odoo-style create-page redesign (separate sub-project, same branch):** the
user showed an Odoo quotation-editor screenshot wanting full visual+functional
parity. That request spans ~9 independent subsystems (most need new backend).
Decomposed via `superpowers:brainstorming`; only subsystem #1 — the visual
layout restructure of `sales-create.tsx` — was built this cycle (status pills,
two-column fields, Order Lines/Other Info tabs, restyled table). Spec + plan:
`docs/superpowers/specs/2026-06-22-sales-create-odoo-layout-design.md` and
`docs/superpowers/plans/2026-06-22-sales-create-odoo-layout.md` (+ reference
screenshot in `docs/superpowers/specs/assets/`). Implemented inline, verified
via `tsc` (27-baseline clean) and a live browser pass (layout matches the
spec; tab-switch correctly preserves Notes/Terms state).

**Full commit sequence on the branch** (base `e078ffcf`): `8efbb0c4` (Task1
service layer) → `e7b035eb` (Task2 routes/nav/lists) → `5c8d5093` (Task3
create+pricelist) → `40842eb0` (Task4 quotation detail) → `3a6d972a` (Task5
order detail+invoice) → `bc18ec80` (Task6 fulfillment) → `18f98ae1` (Task7
returns) → `2ceb9d00` (chore: unused-import sweep) → `8f26c7b5` (docs: Odoo
spec) → `9f4498b3` (docs: Odoo plan) → `d6490409` (feat: Odoo layout restyle)
→ `5b61b0bb` (style: formatter pass across `shared/sales/*`).

## Your task

1. **Resume `superpowers:finishing-a-development-branch`** on this worktree/branch.
   It will want to verify tests — there's no automated frontend test runner
   (no jest/vitest); use `cd client/apps/isomorphic && ./node_modules/.bin/tsc
   --noEmit` and confirm the count is still exactly 27 `TS2688` (pre-existing
   dependency-typing noise, unrelated to this work) with no other errors.
   Then present the merge/PR/keep/discard menu and execute the user's choice.
   **Do not merge or push without the user's explicit say-so** — ask first.

2. **After the branch decision is made**, the remaining open item from Stage A
   is the full manual E2E flow (was started last session, not completed):
   create quotation → send → accept → convert → confirm (cash) → partial
   fulfill ×2 → return. Verify the Outstanding column math, status-gated
   buttons appearing/disappearing correctly, and the partial-failure (amber ⚠️)
   toast path on both fulfill and return.

3. **The Odoo-redesign has 8 deferred subsystems**, each its own future
   spec→plan→build cycle (do NOT build any of these without first asking the
   user which to do, and going through `superpowers:brainstorming` again for
   each — they each need real design decisions, several need new backend):
   Invoice/Delivery Address fields, Payment Terms, order-line sections+notes+
   "Catalog" grid picker, Coupon codes, Rewards (loyalty point redemption),
   Activity/chatter log (no equivalent subsystem exists anywhere in this
   codebase yet), Pro-forma invoice send + Print/PDF, Taxes (per-line tax +
   "Untaxed Amount").

## Dev-environment gotchas (if you need to run the app again)

This worktree's `node_modules` are symlinked to the main checkout's, plus a
few non-obvious fixes were needed — read these before re-spinning up dev
servers, to avoid re-discovering them the expensive way:

1. **`client/node_modules`** (the pnpm workspace root) has some packages
   hoisted directly there (e.g. `jotai`, `ahooks`, `@uploadthing`), not just
   under `client/node_modules/.pnpm/`. If you symlink only the per-app
   `node_modules` dirs (`apps/isomorphic/node_modules`,
   `packages/isomorphic-core/node_modules`) but skip this root one, you'll see
   phantom `TS2307` errors in `packages/isomorphic-core` that don't reproduce
   in the main checkout. (A stale `tsconfig.tsbuildinfo` cache was briefly
   suspected as the cause — it wasn't; the missing symlink was.)
2. **`server/node_modules` is unusually tracked in git** in this repo. Running
   `ln -s <target> server/node_modules` when a real (tracked) directory
   already exists there silently nests the symlink *inside* it instead of
   replacing it. Fix: `rm -rf server/node_modules && ln -s <target>
   server/node_modules`. Critically: **before finishing any session that did
   this, run `git checkout -- server/node_modules`** to restore the tracked
   files — leaving the symlink in place makes `git status` show ~11,800
   "deleted" files (caught and fixed in the previous session; never got
   committed, but it's an easy trap).
3. A **stale `.next` build cache** left over from before the worktree existed
   breaks NextAuth's `/api/auth/*` routes (you'll see 404s and a "missing
   required error components" page). Fix: `rm -rf
   client/apps/isomorphic/.next` and restart `next dev`.
4. **Playwright + this app's login**: navigating straight from a successful
   login to a protected route in the *same page* sometimes races the session
   cookie and bounces to `/signin`. Either retry the `goto` in a loop, or
   capture `storage_state` after login and open a **fresh browser context**
   with it for all subsequent navigation — the fresh-context approach was
   reliable, the same-page approach was flaky.
5. **Test login:** no known password for the real tenant-owner accounts on
   the well-stocked `drinksharbour` tenant (10 subproducts, 4 warehouses, 4
   pricelists, a customer "Ada obi" with an assigned pricelist — ideal for
   exercising the pricelist-auto-apply flow). The previous session
   temporarily reset `david@drinksharbour.test` (a `tenant_staff` seed
   account with no prior password) to a known value, tested, then restored it
   to no-password — so it's clean again. If you need to log in as that
   tenant, you'll need to either ask the user for real credentials or repeat
   that same temporary-reset-then-restore pattern.

## Memory pointer

`MEMORY.md` → `sales_module_progress.md` has the full durable resume note
(commit sequence, redesign scope decomposition, dev-environment gotchas).
