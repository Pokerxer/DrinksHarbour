# Roles & Permissions — Audit and Harden

**Date:** 2026-08-07
**Branch:** main (baseline `2fbd484c`)
**Scope decision:** Option A — audit and harden. No permission system, no migration, no route refactor.

---

## 1. What the investigation established

### 1.1 The role/permission gap is NOT exploitable

The premise under investigation was that the admin client defines a permission model
(`ROLE_PERMISSIONS`, ~35 capabilities) the server does not enforce, so a permission the UI
hides may still be reachable via the API.

Tested empirically against a live server with a real `tenant_staff` token
(`alice@wyncity.ng`, tenant `wyncity`), on 12 endpoints backing permissions the map denies
that role:

```
POST /products · DELETE /products/:id · POST /users · GET /users
PUT /tenants/admin/:id · POST /categories/admin · DELETE /categories/admin/:id
POST /subcategories/admin · POST /brands/admin · DELETE /brands/admin/:id
POST /inventory/adjust · POST /banners
```

**Result: 12/12 → 403.** Control: anonymous → 401 on the same routes.

This is a **consistency problem, not a security bug.** Nothing in this spec treats it as one.

### 1.2 The audit did find a real vulnerability — unrelated to roles

`server/routes/brand.routes.js:28-33` declares five routes under a comment reading
`// Protected routes (existing)` with **no guard of any kind**:

```js
router.post('/', brandController.createBrand);
router.put('/:id', brandController.updateBrand);
router.patch('/:id', brandController.patchBrand);
router.delete('/:id', brandController.deleteBrand);
router.post('/:id/recalculate', brandController.recalculateProductCount);
```

Verified with **no token**, using a non-existent ObjectId and an empty body so nothing was
mutated:

| Request | local | **prod** |
|---|---|---|
| `POST /api/brands` | 400 | **400** |
| `PATCH /api/brands/:id` | 404 | **404** |
| `DELETE /api/brands/:id` | 404 | **404** |
| `POST /api/brands/:id/recalculate` | **200** | — |

400/404/200 all mean the request **reached the controller**. A valid brand ID would delete
a brand anonymously, in production.

CSRF does not mitigate this: `csrf.middleware.js:106` skips the check entirely when no auth
cookie is present, and `:89` skips it for any `Authorization: Bearer` request.

Correctly guarded twins already exist twelve lines above at `/admin/*`.

### 1.3 The server is *more* permissive than the client map

`adminRoles = ['super_admin','admin','tenant_owner','tenant_admin']` in
`brand.routes.js:9`, `category.routes.js:7`, `subcategory.routes.js:7`. The map grants
`tenant_admin` only `categories:read` / `brands:read`.

Probed with a real `tenant_admin` token — **10/10 passed authorization**: create, update and
delete on `/categories/admin/*`, `/subcategories/admin/*`, `/brands/admin/*`, `/banners/*`.

Model inspection shows why this matters:

- **`Brand`** — no `tenant` field. Platform-wide.
- **`Category` / `SubCategory`** — the only tenant-ish field is `tenantPresenceCount`, a
  denormalised counter, **not ownership**. Platform-wide.
- **`Banner`** — genuinely tenant-scoped (`tenant` ref, `{tenant, placement, isActive}`
  index) and sold per plan (`requiredPlan: 'starter'`).

So one tenant's admin can delete a global brand every other tenant and the storefront
depend on. Banners are the exception and are excluded from any restriction here.

### 1.4 The client permission layer is dead code

`types/authorization.ts` → `utils/authorization.ts` → `hooks/use-authorization.ts` →
`hoc/with-authorization.tsx` has **zero consumers**. So does `lib/server-auth.ts`'s
`requirePermission` / `requireAnyPermission`.

Only the role-*name* exports (`PLATFORM_ROLES`, `TENANT_ROLES`, `ADMIN_ACCESS_ROLES`,
`isPlatformRole`, `isTenantRole`) are load-bearing — in `middleware.ts`, `sidebar-menu.tsx`,
and the NextAuth session guard. The UI therefore hides nothing by permission either; it
gates on role names and URL prefixes.

### 1.5 Guard coverage is otherwise healthy

All **580 endpoints** across 57 route files were parsed, resolving `router.use` globals and
guard-array variables. 53 carry no guard; 48 are legitimately public (storefront GETs,
analytics beacons, payment webhooks, chatbot, tenant signup, email verification, cart
validate). **The five brand routes are the only wrong ones.**

### 1.6 Supporting observations

- **`admin` vs `super_admin` is a real code distinction** — `super_admin` alone gets review
  moderation (`review.routes.js:13`), permanent user delete, tenant delete, product
  approve/reject, and cross-tenant visibility (`includeAll`, `statusFilter`). But the
  production role distribution is
  `customer 80 · tenant_staff 36 · tenant_owner 7 · tenant_admin 3 · super_admin 1 · admin 0`
  — **zero users hold `admin`.** Out of scope here; recorded for a future decision.
- **`TENANT_OWNER_ROLES` (`auth.middleware.js:10`) is declared and never referenced.**
- **`banner.routes.js:8`** allows `super_admin, tenant_admin, admin` but omits
  `tenant_owner` — the role that owns the tenant.
- **90 inline role expressions** (not ~32) in `controllers/` + `services/`: 20 hard denials
  (defense-in-depth in services reachable from several routes), 25 scope/visibility
  widening. The latter are row- and field-level (`order.controller.js:482` sets
  `baseFilter['items.tenant']`; `subproduct.service.js:470` widens a status filter) and
  **middleware structurally cannot express them.**

---

## 2. What this work will change

### 2.1 Close the unauthenticated brand routes

Caller analysis decides fix-vs-delete per route:

| Route | Callers | Action |
|---|---|---|
| `POST /` | **2 live** — inline "create brand" modals in the product and sub-product create/edit flows. Both already send `Authorization: Bearer`. | **Guard** — role set and pending-status behaviour defined in §2.3. Adding auth breaks nothing; credentials are already sent. |
| `PUT /:id` | none | **Delete** — unreferenced duplicate of the guarded `/admin/:id`. |
| `PATCH /:id` | none | **Delete** — same. |
| `DELETE /:id` | none | **Delete** — same. |
| `POST /:id/recalculate` | none | **Guard** (platform admin) — a real maintenance op worth keeping. |

### 2.2 Restrict platform taxonomy writes to platform admins

`adminRoles` narrows to `['super_admin','admin']` in `brand.routes.js`,
`category.routes.js`, `subcategory.routes.js`.

**Banners are excluded** — `Banner` is tenant-scoped and plan-gated, so tenant writes are
legitimate. Fix the `tenant_owner` omission in `banner.routes.js:8` while there.

Low breakage risk, corroborated by two independent sources that already agree tenants
should be read-only here: `ROLE_PERMISSIONS`, and the tenant sidebar
(`tenant-menu-items.tsx:168-181`), which deliberately omits every "Add Category" /
"Add Sub-category" / "Add Brand" entry the platform sidebar carries.

### 2.3 Preserve the inline brand-creation flow via pending brands

The one tenant workflow the restriction would break is the inline "create brand" modal in
the tenant-facing sub-product flow.

`POST /api/brands` is guarded with
`protect, authorize('super_admin','admin','tenant_owner','tenant_admin','tenant_staff')`,
and the controller branches on role:

| Caller role | Result |
|---|---|
| `super_admin`, `admin` | Brand created `status:'active'` (unchanged behaviour) |
| `tenant_owner`, `tenant_admin`, `tenant_staff` | Brand created **`status:'pending'`** |
| `customer`, unauthenticated | **403 / 401** |

`tenant_staff` is included deliberately: they hold `subproducts:write` and the inline modal
lives in the sub-product create/edit flow they use. Excluding them would break the same
workflow this section exists to preserve.

The other four brand routes remain platform-admin only — a tenant can *propose* a brand,
never edit, delete, or approve one.

This mirrors an existing pattern rather than inventing one: `Brand.status` already has
`'pending'` in its enum (`models/Brand.js:317`), and `product.service.js:504` already
auto-creates brands with `status: 'pending', // Auto-created brands need approval`.

**No new approval UI is required.** There is no dedicated `approveBrand` endpoint, but the
admin brand list already surfaces the full pending workflow: a `Pending` status filter
(`brand-list/filters.tsx:12`), a `Pending` badge (`brand-list/columns.tsx:16`), and a
`Pending` option in the edit form's status dropdown (`create-brand.tsx:89`). A platform
admin filters to pending and flips status via the existing guarded
`PUT /api/brands/admin/:id`. That path is the approval mechanism.

### 2.4 Make `ROLE_PERMISSIONS` honest and keep it honest

Keep the map — do not delete it — but correct it to match actual server enforcement,
including the taxonomy change in §2.2, and add a test that fails when the map and the
server disagree.

This keeps the door open for a future server-side permission system without building one
now, and removes the trap that made a consistency gap read as a live vulnerability.

Delete only the genuinely dead `TENANT_OWNER_ROLES` constant.

### 2.5 A guard-coverage regression test

A `node:test` that walks every route file, resolves `router.use` globals and guard-array
variables, and asserts **every mutating endpoint carries an auth guard** — with an explicit,
commented allowlist for the 15 legitimately-public ones.

This is the durable artifact: it is what would have caught the brand hole on the day it was
introduced. The audit script written during investigation is most of the implementation.

---

## 3. Explicitly out of scope

- **Tenant isolation** (`requireOwnTenant`) — working, deliberately designed, separate axis.
- **The MFA / `x-mfa-token` flow** — shipped and working.
- **The POS permission system** — read as reference only.
- **A server-side `requirePermission` middleware** — Option A+ was considered and not
  chosen. The vulnerability found was a *missing guard*, not a missing permission system;
  building permissions would not have prevented it.
- **The 90 inline role checks** — 25 are row/field-level and cannot be middleware; the 20
  denials are cheap defense-in-depth. Centralising is churn with no safety gain.
- **Resolving the `admin` tier (0 users)** — recorded in §1.6, deferred.

---

## 4. Testing strategy

Auth changes are security-sensitive, so every behaviour change follows
`superpowers:test-driven-development` — the failing test lands first.

1. **Brand exposure (§2.1).** Failing test asserting `401` unauthenticated on all five
   routes, written and observed failing *before* any guard is added.
2. **Taxonomy restriction (§2.2).** Failing test asserting `403` for `tenant_admin` on
   brand/category/subcategory admin writes; plus a test that `tenant_owner` is *allowed* on
   banners (the `banner.routes.js:8` fix).
3. **Pending brands (§2.3).** Test that a tenant-role create yields `status:'pending'` and a
   platform-admin create yields `status:'active'`.
4. **Map honesty (§2.4).** Test comparing `ROLE_PERMISSIONS` against the enforced matrix.
5. **Guard coverage (§2.5).** The walker test, with the public allowlist.

### Baselines that must not regress

| Suite | Command | Baseline |
|---|---|---|
| Server | `cd server && node --test '__tests__/*.test.js'` | **1308 pass / 3 fail of 1311** (3 pre-existing: 1 pricelist populate, 2 SO-number) — re-measured and confirmed this session |
| Admin vitest | `cd client/apps/admin && npx vitest run` | 208/208 |
| Admin typecheck | `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit` | 461 errors (ignore `.next/**`; `npx tsc` falsely reports 0) |

No new dependencies are required. If that changes, verify CJS loadability with
`node --no-experimental-require-module` (guarded by `__tests__/cjsRequireable.test.js`) —
a prod outage on 2026-08-06 came from an ESM-only transitive dep.

---

## 5. Working-tree note

At the start of this session the worktree contained **12 unstaged deletions** not present in
the session-start snapshot — `PurchaseOrder.js`, `purchaseOrder.routes.js`,
`purchaseOrder.controller.js`, `salesOrder.quotation.test.js`, and 8 admin
quotation/purchase files. They crashed the server on boot
(`Cannot find module './routes/purchaseOrder.routes'`).

They were pure deletions with nothing else modified, so they were restored with
`git checkout --`. The worktree is clean and the server test suite is at its stated
baseline. **If that deletion was intentional it must be redone deliberately** — as of now
it breaks `npm run dev`.
