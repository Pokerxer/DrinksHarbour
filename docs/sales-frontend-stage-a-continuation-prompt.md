# Continuation Prompt — /sales Frontend Stage A (execute the plan)

> Paste everything below the line into a NEW Claude Code session at the repo root
> (`/Users/mac/Documents/drinksharbour`). It is self-contained. A previous
> session did the git cleanup, brainstorming, spec, and full implementation
> plan — your job is to EXECUTE the plan task-by-task.

---

## What's already done (do NOT redo)

The `/sales` **backend** is merged into `main` (merge commit `72394657`) — 9 working
endpoints under `/api/sales-orders`. The leftover `feat/sales-module` worktree/branch
were already cleaned up.

A **spec** and a **complete, code-level implementation plan** for the frontend
"Stage A" (transactional core) are committed on `main`:

- Spec: `docs/superpowers/specs/2026-06-22-sales-frontend-stage-a-design.md`
- **Plan (your script): `docs/superpowers/plans/2026-06-22-sales-frontend-stage-a.md`**

The plan is exhaustive: it contains the full source for every file, exact paths,
typecheck commands, manual-verification steps, and per-task commit commands. You
should not need to re-derive designs — just execute. Read the plan first, in full.

## Your task

Execute the Stage A plan's **7 tasks in order**, using the
**superpowers:subagent-driven-development** skill (dispatch a fresh subagent per
task, review between tasks). The plan's header names this as the required sub-skill.

### Setup (before Task 1)

1. Read the plan top-to-bottom:
   `docs/superpowers/plans/2026-06-22-sales-frontend-stage-a.md`.
2. Create an isolated worktree via the **superpowers:using-git-worktrees** skill —
   use the native `EnterWorktree` tool (do NOT `git worktree add` manually).
   Branch: `feat/sales-frontend` off `main`. (The repo's prior worktrees live under
   `.claude/worktrees/`.)
3. In the worktree, install deps if needed and record the **TS baseline**:
   `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -c "TS2688"`
   — expect **27**. This is the baseline every task compares against (the plan's
   acceptance is "no new errors beyond the 27 `TS2688` baseline").

### The 7 tasks (all detailed in the plan)

1. **Client service layer** — `services/salesOrder.service.ts` (typed wrappers for all 9 endpoints).
2. **Routing skeleton + sidebar nav + Quotations/Orders lists** — `routes.ts` + `tenant-menu-items.tsx` edits, `sales-helpers.ts`, `sales-nav-header.tsx`, `sales-quotations.tsx`, `sales-orders.tsx`, 3 route shells.
3. **Create page** — `customer-search.tsx`, `use-sales-customer-pricelist.ts`, `product-line-search.tsx`, `sales-create.tsx` + shell. (Pricelist auto-apply via the NEW hook over `posApi.getPricelists(token,undefined,customerId)` + pure `computeItemPriceWithPricelist`.)
4. **Quotation detail** — `sales-detail.tsx` (fetch+branch router), `sales-quotation-detail.tsx` + shell. (Task 4 leaves a one-task placeholder for the order branch — Task 5 Step 3 replaces it; this is intentional and documented in the plan.)
5. **Order detail + invoice** — `sales-order-detail.tsx`, `sales-invoice-view.tsx`, edit `sales-detail.tsx`.
6. **Fulfillment** — `sales-fulfill.tsx`, `sales-fulfill-detail.tsx` + 2 shells.
7. **Returns** — `sales-returns.tsx`, `sales-return-create.tsx`, `sales-return-detail.tsx` + 3 shells.

Each task ends with its own `tsc --noEmit` check and a commit (commit messages are
in the plan). Follow them verbatim.

### Execution discipline

- **No frontend test runner exists** (no jest/vitest) — verification per task is
  `./node_modules/.bin/tsc --noEmit` (clean beyond the 27 TS2688 baseline) plus
  the manual browser steps the plan spells out.
- **Two execution-time risks the plan flags** (each with fallback instructions):
  (a) `POSCartItem`'s currently-required fields — in Task 3, adjust the
  `pricingItem` literal in `sales-create.tsx`'s `liveUnitPrice` if the type has
  gained required fields; do NOT modify `computeItemPriceWithPricelist`.
  (b) `rizzui` `Badge`/`Title`/`Text` prop unions — in Task 5, match the usage in
  `client/apps/isomorphic/src/app/shared/invoice/invoice-details.tsx`.
- Mirror `shared/purchases/*` conventions throughout (the plan's code already does).
- Money: reuse `fmtCur`/`fmtPrice` from
  `shared/purchases/purchases-analytics-helpers.ts` / `shared/purchases/types.ts`.
- Keep files focused (<200–300 lines) per `AGENTS.md`.

### Final acceptance (after Task 7)

- `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v "TS2688"`
  → no output.
- `... | grep -c "TS2688"` → still **27**.
- Manual end-to-end: create quotation → send → accept → convert → confirm (cash)
  → partial fulfill ×2 → return. Verify the Outstanding column math, status-gated
  buttons, and the partial-failure (amber ⚠️) toast path.
- When green, use **superpowers:finishing-a-development-branch** to decide
  merge/PR/cleanup. Do NOT push or merge without the user's say-so.

### Manual verification needs a running app + login

To exercise flows in the browser, run the server + client dev servers
(`npm run dev` in `server/` and `client/apps/isomorphic/`). Seeded login creds are
in `server/scripts/seed.js` (tenant owner password `Tenant@123!SecurePassword`).
A customer with an assigned `POSCustomer.pricelist` is needed to see pricelist
auto-apply in Task 3 (assign one via the Pricelists/Customers admin UI if none
exists, or pick an existing one).

## Out of scope (Stage B — a future, separate plan)

`sales-analytics.tsx` + `sales-settings.tsx` and their NEW backend
(`Tenant.salesSettings` + `GET/PATCH /api/sales-orders/settings` +
`/analytics/summary` + `/analytics/by-customer`), and the dedicated
`POST /:id/invoice` + persisted Invoice doc. Do NOT build these now.

## Memory pointer

`MEMORY.md` → `sales_module_progress.md` has the durable resume note (backend
merged; Stage A spec+plan committed; build in worktree `.claude/worktrees/sales-frontend`).
