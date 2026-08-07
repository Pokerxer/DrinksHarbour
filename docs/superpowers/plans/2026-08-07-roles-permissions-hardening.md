# Roles & Permissions Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close five unauthenticated brand-mutation routes that are live in production, restrict platform-taxonomy writes to platform admins while preserving the tenant inline brand-creation flow via pending brands, and leave behind two regression tests that make either regression impossible to reintroduce silently.

**Architecture:** All changes are additive guards on existing Express routers plus one role branch in one controller. No new middleware, no permission system, no data migration. The two durable tests introspect the **live Express router objects** (`router.stack`) rather than parsing route source — `require()`ing a route file yields a router whose layers expose `route.path`, `route.methods` and the ordered handler chain, so `router.use(...)` globals and guard-array variables are resolved by Express itself for free. Behavioural auth tests boot a throwaway Express app around a single router on an ephemeral port and issue real HTTP requests with `fetch`; collaborators are mocked with `node:test`'s `t.mock.method` so no database is touched.

**Tech Stack:** Node 22, Express 5, Mongoose, `node:test` + `node:assert` (NOT jest), JWT via `jsonwebtoken`. Admin client is Next.js + TypeScript, tested with Vitest.

## Global Constraints

- **No commits, no pushes.** Leave every change uncommitted in the working tree unless the user explicitly asks to commit in that same turn. The `Commit` steps that normally end a task are deliberately **absent** from this plan.
- **No new dependencies.** Everything below uses Node built-ins, Express, Mongoose and `jsonwebtoken`, all already present. If a dependency ever becomes necessary, verify CJS loadability with `node --no-experimental-require-module` first — an ESM-only transitive dep took production down on 2026-08-06.
- **Tests are `node:test`, not jest.** Run them with `cd server && node --test '__tests__/<file>'`. `npm test` is broken; do not use it.
- **Scripts that need `dotenv`/`mongoose` must live under `server/`** — the scratchpad has no `node_modules`.
- **Never open `server/_insp.js`** (standing repo rule).
- **Baselines that must not regress:**

| Suite | Command | Baseline |
|---|---|---|
| Server | `cd server && node --test '__tests__/*.test.js'` | **1308 pass / 3 fail of 1311**. The 3 failures are pre-existing and unrelated (1 pricelist populate, 2 SO-number). |
| Admin vitest | `cd client/apps/admin && npx vitest run` | 208/208. Must `cd` in — running from `server/` silently installs vitest 4 and reports "No test files found". |
| Admin typecheck | `cd client/apps/admin && ./node_modules/.bin/tsc --noEmit` | 461 errors. Ignore `.next/**`. `npx tsc` lies and reports 0 — use the `./node_modules/.bin/tsc` path. |

- **Any test stub of `auth.middleware` MUST also export `requireOwnTenant`**, or `router.use(undefined)` throws before any test body runs.
- **Before starting, confirm `git status` is clean.** A previous session began with 12 unstaged deletions (`PurchaseOrder.js`, `purchaseOrder.routes.js`, `purchaseOrder.controller.js`, `salesOrder.quotation.test.js` + 8 admin quotation/purchase files) that crashed the server on boot with `Cannot find module './routes/purchaseOrder.routes'`. The only expected untracked files are `docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md` and this plan.

## Correction to the spec, established while writing this plan

**§2.3's stated rationale for including `tenant_staff` is factually wrong, but the decision it supports still stands.**

The spec says `tenant_staff` is included in `POST /api/brands` because "they hold `subproducts:write`". They do in the client map — but the server denies it. `subproduct.routes.js` declares `POST /` **twice**: the reachable one (Express layer index 5) is guarded by `tenantAdminOrSuperAdmin` = `super_admin, admin, tenant_owner, tenant_admin`; the second declaration at line ~1633 (`protect, authorize('tenant_admin','super_admin')`) is unreachable dead code. So a `tenant_staff` cannot create a sub-product at all, and cannot reach the inline brand modal that lives in that flow.

Including `tenant_staff` in `POST /api/brands` is therefore harmless but currently unreachable. **Task 3 implements the decision as written** (it is the user's call and it is the more permissive option). **Task 4 removes `subproducts:write` from `tenant_staff` in the map**, because that is what the server actually enforces.

---

## File Structure

| File | Task | Responsibility |
|---|---|---|
| `server/__tests__/helpers/routeAuthHarness.js` | 1 (created), 2–3 (reused) | Boots one router on an ephemeral port; mints role JWTs; mocks `User.findById` so `protect` resolves without a database. |
| `server/__tests__/brandRouteAuth.test.js` | 1 | Pins that the five previously-open brand routes reject anonymous callers. |
| `server/routes/brand.routes.js` | 1, 2 | Guard `POST /` + `POST /:id/recalculate`; delete three unreferenced duplicates; narrow `adminRoles`. |
| `server/__tests__/taxonomyWriteRoles.test.js` | 2 | Pins platform-admin-only writes on brand/category/subcategory and `tenant_owner` access on banners. |
| `server/routes/category.routes.js`, `server/routes/subcategory.routes.js` | 2 | Narrow `adminRoles`. |
| `server/routes/banner.routes.js` | 2 | Add the missing `tenant_owner`. |
| `server/__tests__/brandPendingStatus.test.js` | 3 | Pins the role → status branch on `POST /api/brands`. |
| `server/controllers/brand.controller.js` | 3 | `createBrand` forces `status` from the caller's role. |
| `server/middleware/auth.middleware.js` | 4 | Expose `authorizedRoles` metadata on role guards; delete dead `TENANT_OWNER_ROLES`. |
| `server/__tests__/authorizedRolesMetadata.test.js` | 4 | Proves each `authorizedRoles` tag matches the guard's runtime behaviour, so the tags cannot drift. |
| `server/__tests__/rolePermissionMap.test.js` | 4 | Compares the admin client's `ROLE_PERMISSIONS` against role sets read out of the live routers. |
| `client/apps/admin/src/types/authorization.ts` | 4 | Corrected `ROLE_PERMISSIONS`. |
| `server/__tests__/routeGuardCoverage.test.js` | 5 | Walks every router and asserts every mutating endpoint carries an auth guard, with a commented public allowlist. |

---

## Task 1: Close the unauthenticated brand routes

**This is live in production. Do it first.**

`server/routes/brand.routes.js:28-33` declares five routes under a comment reading `// Protected routes (existing)` with no guard of any kind. An anonymous `DELETE /api/brands/:id` with a real brand id deletes a brand. CSRF does not mitigate it: `csrf.middleware.js:106` skips the check when no auth cookie is present, and `:89` skips it for any `Authorization: Bearer` request.

Three of the five are unreferenced duplicates of guarded `/admin/:id` twins twelve lines above and are deleted rather than guarded. Two are kept and guarded.

**Files:**
- Create: `server/__tests__/helpers/routeAuthHarness.js`
- Create: `server/__tests__/brandRouteAuth.test.js`
- Modify: `server/routes/brand.routes.js:28-33`

**Interfaces:**
- Produces (consumed by Tasks 2 and 3): `startRouter(router, basePath)` → `{ url(path), close() }`; `mockAuthUser(t, user)`; `signToken(user)`; `ROLE_USERS`.

---

- [ ] **Step 1: Write the shared route-auth harness**

Create `server/__tests__/helpers/routeAuthHarness.js`:

```js
// Boots a throwaway Express app around a single router so route guards can be
// exercised over real HTTP without a database and without server.js's full
// bootstrap. Used by brandRouteAuth, taxonomyWriteRoles and brandPendingStatus.
//
// `protect` verifies a JWT and then loads the user with
//   User.findById(id).select(...).lean()
// so authenticating as a role means (a) signing a token with the same secret
// and (b) mocking that one query chain. Nothing else touches Mongo.

'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../../models/User');

// No test here connects to Mongo. If a request slips past a guard and reaches a
// controller, the model call would otherwise sit in Mongoose's 10s buffering
// window before failing — turning one bad assertion into a two-minute hang.
// Fail fast instead, so "reached the controller" shows up immediately.
mongoose.set('bufferTimeoutMS', 200);

const TENANT_ID = new mongoose.Types.ObjectId();

/** One canonical active user per role, reused across the auth test files. */
const ROLE_USERS = {
  super_admin: { _id: new mongoose.Types.ObjectId(), email: 'sa@test.local', role: 'super_admin', tenant: TENANT_ID, status: 'active' },
  admin:       { _id: new mongoose.Types.ObjectId(), email: 'ad@test.local', role: 'admin',       tenant: TENANT_ID, status: 'active' },
  tenant_owner:{ _id: new mongoose.Types.ObjectId(), email: 'to@test.local', role: 'tenant_owner',tenant: TENANT_ID, status: 'active' },
  tenant_admin:{ _id: new mongoose.Types.ObjectId(), email: 'ta@test.local', role: 'tenant_admin',tenant: TENANT_ID, status: 'active' },
  tenant_staff:{ _id: new mongoose.Types.ObjectId(), email: 'ts@test.local', role: 'tenant_staff',tenant: TENANT_ID, status: 'active' },
  customer:    { _id: new mongoose.Types.ObjectId(), email: 'cu@test.local', role: 'customer',    tenant: null,      status: 'active' },
};

/** Signs the payload shape services/user.service.js issues at login. */
function signToken(user) {
  return jwt.sign(
    { userId: String(user._id), email: user.email, role: user.role, tenant: user.tenant ? String(user.tenant) : null },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Makes `protect` resolve every token to `user`. Returns an Authorization
 * header value for that user. Scoped to the test `t` — node:test restores the
 * original method when the test ends.
 */
function mockAuthUser(t, user) {
  t.mock.method(User, 'findById', () => ({
    select: () => ({ lean: async () => ({ ...user }) }),
  }));
  return `Bearer ${signToken(user)}`;
}

/**
 * Mounts `router` at `basePath` behind a minimal error handler that mirrors
 * server.js's `err.statusCode || 500` mapping, and listens on an ephemeral
 * port. Always `await close()` in a finally block.
 */
async function startRouter(router, basePath = '/') {
  const app = express();
  app.use(express.json());
  app.use(basePath, router);
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || err.status || 500).json({ message: err.message });
  });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();

  return {
    url: (p) => `http://127.0.0.1:${port}${p}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

module.exports = { startRouter, mockAuthUser, signToken, ROLE_USERS, TENANT_ID };
```

- [ ] **Step 2: Write the failing test**

Create `server/__tests__/brandRouteAuth.test.js`:

```js
// server/routes/brand.routes.js declared five brand-mutation routes under a
// comment reading "// Protected routes (existing)" with no guard at all:
//
//   POST /  ·  PUT /:id  ·  PATCH /:id  ·  DELETE /:id  ·  POST /:id/recalculate
//
// Verified anonymously against production on 2026-08-07 with a non-existent
// ObjectId and an empty body (so nothing mutated): POST / → 400,
// PATCH /:id → 404, DELETE /:id → 404, POST /:id/recalculate → 200 locally.
// 400/404/200 all mean the request reached the controller — a valid id would
// have deleted a brand anonymously, in production.
//
// PUT/PATCH/DELETE /:id had no callers and were unreferenced duplicates of the
// guarded /admin/:id twins, so they are gone; the two survivors are guarded.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.1

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');

const brandService = require('../services/brand.service');
const brandRouter = require('../routes/brand.routes');
const { startRouter } = require('./helpers/routeAuthHarness');

const ABSENT_ID = '000000000000000000000000';

/**
 * Neutralises every brand-service call the five routes can reach, so if a
 * request DOES slip past the guards the controller answers instantly with a
 * 2xx instead of stalling on Mongoose's 10s buffering timeout. That makes
 * "reached the controller" fast and unambiguous.
 */
function stubBrandService(t) {
  t.mock.method(brandService, 'createBrand', async () => ({ _id: ABSENT_ID }));
  t.mock.method(brandService, 'updateProductCount', async () => 0);
}

async function withApp(fn) {
  const app = await startRouter(brandRouter, '/api/brands');
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

test('POST /api/brands rejects an anonymous caller', async (t) => {
  stubBrandService(t);
  await withApp(async (app) => {
    const res = await fetch(app.url('/api/brands'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.strictEqual(res.status, 401, 'anonymous brand creation must be refused');
  });
});

test('POST /api/brands/:id/recalculate rejects an anonymous caller', async (t) => {
  stubBrandService(t);
  await withApp(async (app) => {
    const res = await fetch(app.url(`/api/brands/${ABSENT_ID}/recalculate`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.strictEqual(res.status, 401);
  });
});

test('the unguarded PUT/PATCH/DELETE /api/brands/:id duplicates no longer exist', async (t) => {
  stubBrandService(t);
  await withApp(async (app) => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const res = await fetch(app.url(`/api/brands/${ABSENT_ID}`), {
        method,
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      assert.strictEqual(
        res.status,
        404,
        `${method} /api/brands/:id must not be routed — the guarded /admin/:id twin is the only way in`
      );
    }
  });
});

test('the guarded /admin twins are still declared', () => {
  // Deleting the duplicates must not have taken the real routes with them.
  const declared = brandRouter.stack
    .filter((l) => l.route)
    .map((l) => `${Object.keys(l.route.methods).join(',')} ${l.route.path}`);

  assert.ok(declared.includes('put /admin/:id'), 'PUT /admin/:id must survive');
  assert.ok(declared.includes('delete /admin/:id'), 'DELETE /admin/:id must survive');
  assert.ok(declared.includes('post /admin'), 'POST /admin must survive');
});
```

- [ ] **Step 3: Run the test and confirm it fails for the right reason**

```bash
cd server && node --test '__tests__/brandRouteAuth.test.js'
```

Expected: **3 of 4 tests fail.**
- `POST /api/brands rejects an anonymous caller` → got `201`, expected `401`.
- `POST /api/brands/:id/recalculate rejects an anonymous caller` → got `200`, expected `401`.
- `the unguarded PUT/PATCH/DELETE ... no longer exist` → got `200`/`201`-ish, expected `404`.
- `the guarded /admin twins are still declared` → **passes already** (it is a guard against over-deletion in Step 4).

If instead a test hangs or errors with a Mongoose buffering timeout, the `stubBrandService` mock is not taking effect — fix that before continuing, do not proceed.

- [ ] **Step 4: Apply the fix**

In `server/routes/brand.routes.js`, replace lines 28-33 entirely:

```js
// Protected routes (existing)
router.post('/', brandController.createBrand);
router.put('/:id', brandController.updateBrand);
router.patch('/:id', brandController.patchBrand);
router.delete('/:id', brandController.deleteBrand);
router.post('/:id/recalculate', brandController.recalculateProductCount);
```

with:

```js
// ── Guarded mutations on the bare /:id namespace ─────────────────────────────
// These five used to sit here with no guard at all, which made an anonymous
// DELETE /api/brands/:id a live production hole. PUT/PATCH/DELETE had no
// callers and duplicated the guarded /admin/:id routes above, so they are gone.
//
// POST / keeps a wider role set on purpose: it backs the inline "create brand"
// modal in the product and sub-product flows. Tenant roles get a *pending*
// brand — see brand.controller.createBrand.
router.post(
  '/',
  protect,
  authorize('super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'tenant_staff'),
  brandController.createBrand
);
router.post(
  '/:id/recalculate',
  protect,
  authorize('super_admin', 'admin'),
  brandController.recalculateProductCount
);
```

Leave lines 1-27 untouched. `protect` and `authorize` are already imported on line 6.

`brandController.updateBrand`, `patchBrand` and `deleteBrand` stay exported — they are dead after this change, but removing controller exports is out of scope and would widen the diff. Do not delete them.

- [ ] **Step 5: Run the test and confirm it passes**

```bash
cd server && node --test '__tests__/brandRouteAuth.test.js'
```

Expected: `# pass 4`, `# fail 0`.

---

## Task 2: Restrict platform taxonomy writes; fix the banner `tenant_owner` omission

`adminRoles` in `brand.routes.js:9`, `category.routes.js:7` and `subcategory.routes.js:7` is `['super_admin','admin','tenant_owner','tenant_admin']`. `Brand` has no `tenant` field; `Category`/`SubCategory`'s only tenant-ish field is `tenantPresenceCount`, a denormalised counter and not ownership. All three are platform-wide, so today one tenant's admin can delete a global brand every other tenant and the storefront depend on. A real `tenant_admin` token passed authorization on 10/10 create/update/delete probes.

`Banner` is different — it carries a real `tenant` ref, a `{tenant, placement, isActive}` index, and is plan-gated (`requiredPlan: 'starter'`). **Banners are excluded from the restriction.** While in that file, add the `tenant_owner` that `banner.routes.js:8` omits.

**Files:**
- Create: `server/__tests__/taxonomyWriteRoles.test.js`
- Modify: `server/routes/brand.routes.js:9`, `server/routes/category.routes.js:7`, `server/routes/subcategory.routes.js:7`, `server/routes/banner.routes.js:8`

**Interfaces:**
- Consumes from Task 1: `startRouter`, `mockAuthUser`, `ROLE_USERS` from `./helpers/routeAuthHarness`.

---

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/taxonomyWriteRoles.test.js`:

```js
// Brand, Category and SubCategory are platform-wide: Brand has no `tenant`
// field at all, and Category/SubCategory carry only `tenantPresenceCount`, a
// denormalised counter rather than ownership. Their admin write routes were
// nonetheless open to tenant_owner and tenant_admin, so one tenant's admin
// could delete a global brand the storefront and every other tenant depend on.
//
// Banner is the deliberate exception: it has a real `tenant` ref, a
// {tenant, placement, isActive} index and a per-plan gate, so tenant writes are
// legitimate there. banner.routes.js:8 merely forgot tenant_owner.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.2

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');

const { startRouter, mockAuthUser, ROLE_USERS } = require('./helpers/routeAuthHarness');

const ABSENT_ID = '000000000000000000000000';

const PLATFORM_ONLY = ['super_admin', 'admin'];
const TENANT_ROLES = ['tenant_owner', 'tenant_admin', 'tenant_staff'];

/**
 * Fires one request at `path` as `role` and reports the status. The route's
 * controller is never expected to run for a denied role; for an allowed role it
 * may run and fail on a missing document, which is fine — this test only ever
 * asserts on the 401/403 boundary, never on 2xx.
 */
async function statusAs(t, router, basePath, method, path, role) {
  const app = await startRouter(router, basePath);
  try {
    const authorization = mockAuthUser(t, ROLE_USERS[role]);
    const res = await fetch(app.url(path), {
      method,
      headers: { 'content-type': 'application/json', authorization },
      body: method === 'DELETE' ? undefined : '{}',
    });
    return res.status;
  } finally {
    await app.close();
  }
}

const TAXONOMY_WRITES = [
  ['brand', '../routes/brand.routes', '/api/brands', 'POST', '/api/brands/admin'],
  ['brand', '../routes/brand.routes', '/api/brands', 'PUT', `/api/brands/admin/${ABSENT_ID}`],
  ['brand', '../routes/brand.routes', '/api/brands', 'DELETE', `/api/brands/admin/${ABSENT_ID}`],
  ['category', '../routes/category.routes', '/api/categories', 'POST', '/api/categories/admin'],
  ['category', '../routes/category.routes', '/api/categories', 'DELETE', `/api/categories/admin/${ABSENT_ID}`],
  ['subcategory', '../routes/subcategory.routes', '/api/subcategories', 'POST', '/api/subcategories/admin'],
  ['subcategory', '../routes/subcategory.routes', '/api/subcategories', 'DELETE', `/api/subcategories/admin/${ABSENT_ID}`],
];

for (const [label, modulePath, basePath, method, path] of TAXONOMY_WRITES) {
  for (const role of TENANT_ROLES) {
    test(`${method} ${path} denies ${role} (${label} is platform-wide)`, async (t) => {
      const router = require(modulePath);
      const status = await statusAs(t, router, basePath, method, path, role);
      assert.strictEqual(status, 403, `${role} must not write platform ${label} data`);
    });
  }

  for (const role of PLATFORM_ONLY) {
    test(`${method} ${path} still admits ${role}`, async (t) => {
      const router = require(modulePath);
      const status = await statusAs(t, router, basePath, method, path, role);
      assert.notStrictEqual(status, 401, `${role} must authenticate`);
      assert.notStrictEqual(status, 403, `${role} must pass authorization`);
    });
  }
}

// ── Banners: tenant-scoped and plan-gated, so tenants keep write access ───────

test('POST /api/banners admits tenant_owner (the role that owns the tenant)', async (t) => {
  const router = require('../routes/banner.routes');
  const status = await statusAs(t, router, '/api/banners', 'POST', '/api/banners', 'tenant_owner');
  assert.notStrictEqual(status, 403, 'tenant_owner owns the tenant its banners belong to');
  assert.notStrictEqual(status, 401);
});

test('POST /api/banners still admits tenant_admin', async (t) => {
  const router = require('../routes/banner.routes');
  const status = await statusAs(t, router, '/api/banners', 'POST', '/api/banners', 'tenant_admin');
  assert.notStrictEqual(status, 403);
  assert.notStrictEqual(status, 401);
});

test('POST /api/banners still denies customer', async (t) => {
  const router = require('../routes/banner.routes');
  const status = await statusAs(t, router, '/api/banners', 'POST', '/api/banners', 'customer');
  assert.strictEqual(status, 403);
});
```

- [ ] **Step 2: Run the test and confirm it fails for the right reason**

```bash
cd server && node --test '__tests__/taxonomyWriteRoles.test.js'
```

Expected failures:
- All 14 `denies tenant_owner` / `denies tenant_admin` cases → got a non-403 (the request passed authorization and reached the controller), expected `403`.
- The 7 `denies tenant_staff` cases → **pass already** (`tenant_staff` was never in `adminRoles`).
- `POST /api/banners admits tenant_owner` → got `403`, expected anything else.

- [ ] **Step 3: Narrow `adminRoles` in the three taxonomy route files**

In **`server/routes/brand.routes.js:9`**, replace:

```js
const adminRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'];
```

with:

```js
// Brand carries no `tenant` field — brands are platform-wide, shared by every
// tenant and the storefront, so only platform admins may write them. Tenants
// propose a brand through POST / instead, which yields a pending brand.
const adminRoles = ['super_admin', 'admin'];
```

In **`server/routes/category.routes.js:7`**, replace the identical line with:

```js
// Category is platform-wide: its only tenant-ish field is tenantPresenceCount,
// a denormalised counter, not ownership. Platform admins only.
const adminRoles = ['super_admin', 'admin'];
```

In **`server/routes/subcategory.routes.js:7`**, replace the identical line with:

```js
// SubCategory is platform-wide for the same reason as Category —
// tenantPresenceCount is a counter, not ownership. Platform admins only.
const adminRoles = ['super_admin', 'admin'];
```

- [ ] **Step 4: Add the missing `tenant_owner` to banners**

In `server/routes/banner.routes.js:8`, replace:

```js
const adminOnly = [protect, authorize('super_admin', 'tenant_admin', 'admin')];
```

with:

```js
// Banner really is tenant-scoped (a `tenant` ref plus a
// {tenant, placement, isActive} index) and plan-gated, so tenant roles keep
// write access here — unlike the platform taxonomy. tenant_owner, the role
// that actually owns the tenant, was omitted by mistake.
const adminOnly = [protect, authorize('super_admin', 'admin', 'tenant_owner', 'tenant_admin')];
```

- [ ] **Step 5: Run the test and confirm it passes**

```bash
cd server && node --test '__tests__/taxonomyWriteRoles.test.js'
```

Expected: `# fail 0`.

- [ ] **Step 6: Re-run Task 1's test — Task 2 edited the same file**

```bash
cd server && node --test '__tests__/brandRouteAuth.test.js'
```

Expected: `# pass 4`, `# fail 0`.

---

## Task 3: Tenant-created brands are pending, not active

Narrowing `adminRoles` in Task 2 leaves one legitimate tenant workflow unserved: the inline "create brand" modal in the product and sub-product create/edit flows. Rather than refusing it, `POST /api/brands` (guarded in Task 1 with the wider role set) branches on the caller's role:

| Caller role | Result |
|---|---|
| `super_admin`, `admin` | `status: 'active'` — unchanged behaviour |
| `tenant_owner`, `tenant_admin`, `tenant_staff` | `status: 'pending'` |
| `customer`, unauthenticated | 403 / 401, from the route guard |

This mirrors an existing pattern rather than inventing one: `Brand.status`'s enum already contains `'pending'` (`models/Brand.js:317`, enum `['active','pending','archived','inactive','suspended']`, default `'active'`), and `product.service.js:504` already auto-creates brands with `status: 'pending', // Auto-created brands need approval`.

No approval UI is needed. The admin brand list already has a `Pending` status filter (`brand-list/filters.tsx:12`), a `Pending` badge (`brand-list/columns.tsx:16`) and a `Pending` option in the edit form's status dropdown (`create-brand.tsx:89`). A platform admin filters to pending and flips status via the guarded `PUT /api/brands/admin/:id`.

**The status must be forced, not defaulted.** A `tenant_staff` posting `{"status":"active"}` must still get `pending`, or the guard is decorative.

**Files:**
- Create: `server/__tests__/brandPendingStatus.test.js`
- Modify: `server/controllers/brand.controller.js:31-34`

**Interfaces:**
- Consumes from Task 1: `startRouter`, `mockAuthUser`, `ROLE_USERS`.
- Consumes from Task 1: `POST /api/brands` guarded with `protect, authorize('super_admin','admin','tenant_owner','tenant_admin','tenant_staff')`.

---

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/brandPendingStatus.test.js`:

```js
// Task 2 restricted the platform taxonomy to platform admins. The one tenant
// workflow that would have broken is the inline "create brand" modal in the
// product and sub-product flows, so POST /api/brands stays open to tenant roles
// and yields a *pending* brand instead of an active one. A platform admin then
// approves it by flipping status through the guarded PUT /api/brands/admin/:id.
//
// The status is forced, never defaulted: a tenant posting {"status":"active"}
// must still get "pending", otherwise the whole branch is decorative.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.3

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');

const brandService = require('../services/brand.service');
const brandRouter = require('../routes/brand.routes');
const { startRouter, mockAuthUser, ROLE_USERS } = require('./helpers/routeAuthHarness');

/**
 * Posts `body` as `role` and returns the brandData object the controller handed
 * to brandService.createBrand, so the persisted status can be asserted without
 * a database.
 */
async function createBrandAs(t, role, body) {
  let received = null;
  t.mock.method(brandService, 'createBrand', async (brandData) => {
    received = brandData;
    return { _id: '000000000000000000000000', ...brandData };
  });

  const app = await startRouter(brandRouter, '/api/brands');
  try {
    const authorization = mockAuthUser(t, ROLE_USERS[role]);
    const res = await fetch(app.url('/api/brands'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify(body),
    });
    return { status: res.status, received };
  } finally {
    await app.close();
  }
}

for (const role of ['tenant_owner', 'tenant_admin', 'tenant_staff']) {
  test(`${role} creates a pending brand`, async (t) => {
    const { status, received } = await createBrandAs(t, role, { name: 'Proposed Brand' });
    assert.strictEqual(status, 201);
    assert.strictEqual(received.status, 'pending', `${role} may only propose a brand`);
  });

  test(`${role} cannot self-approve by posting status: 'active'`, async (t) => {
    const { received } = await createBrandAs(t, role, { name: 'Sneaky Brand', status: 'active' });
    assert.strictEqual(received.status, 'pending', 'the caller-supplied status must be overridden');
  });
}

for (const role of ['super_admin', 'admin']) {
  test(`${role} creates an active brand`, async (t) => {
    const { status, received } = await createBrandAs(t, role, { name: 'Platform Brand' });
    assert.strictEqual(status, 201);
    assert.strictEqual(received.status, 'active');
  });

  test(`${role} may still create a brand in an explicit non-active status`, async (t) => {
    // Platform admins keep full control of the field — e.g. staging a brand as
    // pending on purpose. Only tenant roles are pinned.
    const { received } = await createBrandAs(t, role, { name: 'Staged Brand', status: 'pending' });
    assert.strictEqual(received.status, 'pending');
  });
}

test('customer is refused outright', async (t) => {
  const { status } = await createBrandAs(t, 'customer', { name: 'Nope' });
  assert.strictEqual(status, 403, 'a customer may not create brands at all');
});
```

- [ ] **Step 2: Run the test and confirm it fails for the right reason**

```bash
cd server && node --test '__tests__/brandPendingStatus.test.js'
```

Expected failures: the six tenant-role cases — `received.status` is `undefined` (no status sent) or `'active'` (status sent), expected `'pending'`. The `customer is refused outright` case and the platform-admin `pending` case pass already; the platform-admin `active` case fails with `undefined !== 'active'`.

- [ ] **Step 3: Branch `createBrand` on the caller's role**

In `server/controllers/brand.controller.js`, replace lines 26-34:

```js
/**
 * @desc    Create new brand
 * @route   POST /api/brands
 * @access  Private/Admin
 */
exports.createBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.createBrand(req.body, req.user?._id);
  successResponse(res, { brand }, 'Brand created successfully', 201);
});
```

with:

```js
/** Roles whose brand submissions are proposals awaiting platform approval. */
const PROPOSING_ROLES = ['tenant_owner', 'tenant_admin', 'tenant_staff'];

/**
 * @desc    Create new brand
 * @route   POST /api/brands
 * @access  Private — platform admins and tenant roles (see below)
 *
 * Brands are platform-wide, so only a platform admin may publish one. Tenant
 * roles reach this route through the inline "create brand" modal in the product
 * and sub-product flows, and what they get is a *proposal*: status is forced to
 * 'pending' regardless of what the request body asked for, and a platform admin
 * approves it via PUT /api/brands/admin/:id. Same pattern product.service.js
 * already uses for auto-created brands.
 */
exports.createBrand = asyncHandler(async (req, res) => {
  const isProposal = PROPOSING_ROLES.includes(req.user?.role);
  const brandData = {
    ...req.body,
    status: isProposal ? 'pending' : req.body.status || 'active',
  };

  const brand = await brandService.createBrand(brandData, req.user?._id);
  successResponse(
    res,
    { brand },
    isProposal ? 'Brand submitted for approval' : 'Brand created successfully',
    201
  );
});
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd server && node --test '__tests__/brandPendingStatus.test.js'
```

Expected: `# fail 0`.

---

## Task 4: Make `ROLE_PERMISSIONS` honest and keep it honest

The admin client's `ROLE_PERMISSIONS` map has **zero consumers** — `types/authorization.ts` → `utils/authorization.ts` → `hooks/use-authorization.ts` → `hoc/with-authorization.tsx` is dead, as are `lib/server-auth.ts`'s `requirePermission`/`requireAnyPermission`. Only the role-*name* exports (`PLATFORM_ROLES`, `TENANT_ROLES`, `ADMIN_ACCESS_ROLES`, `isPlatformRole`, `isTenantRole`) are load-bearing.

The map is kept, not deleted — but corrected to match what the server enforces, and pinned by a test. That removes the trap that made a consistency gap read as a live vulnerability, and keeps the door open for a future server-side permission system.

The comparison needs the enforced role set per endpoint. Express does not expose the roles captured inside an `authorize(...)` closure, so this task attaches an `authorizedRoles` array to each role guard and adds a test that **executes** each guard against all six roles to prove the tag matches behaviour. The tag therefore cannot drift.

`TENANT_OWNER_ROLES` (`auth.middleware.js:10`) is declared and never referenced anywhere — delete it here.

**Files:**
- Modify: `server/middleware/auth.middleware.js:9-10, 157-237`
- Create: `server/__tests__/authorizedRolesMetadata.test.js`
- Create: `server/__tests__/rolePermissionMap.test.js`
- Modify: `client/apps/admin/src/types/authorization.ts:82-171`

**Interfaces:**
- Produces (consumed by nothing else in this plan, but load-bearing for the test): every role guard exported from `auth.middleware` carries `.authorizedRoles: string[]`, and `authorize(...roles)` returns a function whose `.authorizedRoles` is `roles`.

---

- [ ] **Step 1: Write the failing metadata test**

Create `server/__tests__/authorizedRolesMetadata.test.js`:

```js
// Role guards advertise which roles they admit via an `authorizedRoles` array,
// so a test can read the enforced role set straight off a live Express router
// (Express cannot otherwise show what an authorize(...) closure captured).
//
// Metadata that merely claims something is worse than none, so every tag here
// is checked against the guard's actual runtime behaviour: each guard is run
// once per role and the roles that reach next() must equal the tag exactly.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.4

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const auth = require('../middleware/auth.middleware');

const ALL_ROLES = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'tenant_staff', 'customer'];
const TENANT_ID = new mongoose.Types.ObjectId();

/**
 * Runs `guard` as `role`, with a tenant context that matches the user's own
 * tenant so only the role dimension varies (the tenant-membership branch in
 * tenantAdminOnly/tenantUserOnly is covered by tenantIsolation.test.js).
 */
function admits(guard, role) {
  const req = {
    user: { _id: new mongoose.Types.ObjectId(), role, tenant: TENANT_ID },
    tenant: { _id: TENANT_ID, status: 'approved', subscriptionStatus: 'active' },
    query: {},
    body: {},
    headers: {},
  };
  let passed = false;
  try {
    guard(req, {}, () => { passed = true; });
  } catch {
    return false;
  }
  return passed;
}

const TAGGED_GUARDS = [
  ['superAdminOnly', auth.superAdminOnly],
  ['tenantAdminOnly', auth.tenantAdminOnly],
  ['tenantAdminOrSuperAdmin', auth.tenantAdminOrSuperAdmin],
  ['tenantUserOnly', auth.tenantUserOnly],
];

for (const [name, guard] of TAGGED_GUARDS) {
  test(`${name} declares an authorizedRoles array`, () => {
    assert.ok(Array.isArray(guard.authorizedRoles), `${name}.authorizedRoles must be an array`);
  });

  test(`${name}.authorizedRoles matches its runtime behaviour`, () => {
    const actual = ALL_ROLES.filter((r) => admits(guard, r)).sort();
    assert.deepStrictEqual(
      [...guard.authorizedRoles].sort(),
      actual,
      `${name} admits [${actual}] at runtime — the tag must say exactly that`
    );
  });
}

test('authorize(...roles) tags the guard it returns', () => {
  const guard = auth.authorize('super_admin', 'admin');
  assert.deepStrictEqual(guard.authorizedRoles, ['super_admin', 'admin']);

  const actual = ALL_ROLES.filter((r) => admits(guard, r));
  assert.deepStrictEqual(actual, ['super_admin', 'admin']);
});

test('authorize tags are per-call, not shared', () => {
  const a = auth.authorize('super_admin');
  const b = auth.authorize('tenant_staff');
  assert.deepStrictEqual(a.authorizedRoles, ['super_admin']);
  assert.deepStrictEqual(b.authorizedRoles, ['tenant_staff']);
});

test('the dead TENANT_OWNER_ROLES constant is gone', () => {
  assert.strictEqual(
    auth.TENANT_OWNER_ROLES,
    undefined,
    'TENANT_OWNER_ROLES was declared and never referenced'
  );
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd server && node --test '__tests__/authorizedRolesMetadata.test.js'
```

Expected: the 4 `declares an authorizedRoles array` tests fail (`undefined` is not an array), the 4 `matches its runtime behaviour` tests fail on spreading `undefined`, and `authorize(...roles) tags the guard it returns` fails. `the dead TENANT_OWNER_ROLES constant is gone` passes already — it was never exported, only declared.

- [ ] **Step 3: Tag the guards and delete the dead constant**

In `server/middleware/auth.middleware.js`:

**(a)** Delete lines 9-10 entirely:

```js
// super_admin has all tenant_owner privileges
const TENANT_OWNER_ROLES = ['super_admin', 'admin', 'tenant_owner'];
```

**(b)** Replace `superAdminOnly` (currently lines 154-162) with:

```js
/**
 * Super-admin only
 */
const superAdminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    throw new ForbiddenError('Super-admin access required');
  }
  next();
};
superAdminOnly.authorizedRoles = ['super_admin'];
```

**(c)** Append after the existing `tenantAdminOnly` definition (currently ending line 180):

```js
tenantAdminOnly.authorizedRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'];
```

**(d)** Append after the existing `tenantAdminOrSuperAdmin` definition (currently ending line 202):

```js
tenantAdminOrSuperAdmin.authorizedRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'];
```

**(e)** Append after the existing `tenantUserOnly` definition (currently ending line 219):

```js
tenantUserOnly.authorizedRoles = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'tenant_staff'];
```

**(f)** Replace `authorize` (currently lines 221-237) with:

```js
/**
 * Authorize by role(s) - allows multiple roles
 *
 * The returned guard carries `authorizedRoles` so tests can read the enforced
 * role set off a live Express router — Express cannot otherwise reveal what a
 * closure captured. authorizedRolesMetadata.test.js proves the tag matches
 * behaviour, so it cannot drift.
 *
 * @param {...string} roles - Roles to allow
 */
const authorize = (...roles) => {
  const guard = (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Not authorized - no user found');
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    next();
  };
  guard.authorizedRoles = roles;
  return guard;
};
```

Leave `module.exports` unchanged — the tags ride on the functions already exported.

- [ ] **Step 4: Run it and confirm it passes**

```bash
cd server && node --test '__tests__/authorizedRolesMetadata.test.js'
```

Expected: `# fail 0`.

- [ ] **Step 5: Write the failing map-consistency test**

Create `server/__tests__/rolePermissionMap.test.js`:

```js
// The admin client declares ROLE_PERMISSIONS (client/apps/admin/src/types/
// authorization.ts) but nothing consumes it — the whole
// types → utils → hooks → hoc chain is dead code, and so are
// lib/server-auth.ts's requirePermission/requireAnyPermission. Only the
// role-NAME exports are load-bearing.
//
// The map is kept rather than deleted, so it has to be true. This test reads
// the enforced role set for each bound endpoint off the live Express routers
// (via the authorizedRoles tags proven in authorizedRolesMetadata.test.js) and
// asserts the map agrees exactly.
//
// SCOPE, deliberately: only write/delete permissions are bound. Read
// permissions mostly back public storefront GETs where every role — including
// an anonymous caller — can read, so comparing them would say nothing. And the
// comparison is of ROUTE-LEVEL role gates only; documented inline narrowings
// (super_admin alone gets permanent user delete, tenant delete, product
// approve/reject, and cross-tenant includeAll/statusFilter) are finer than any
// route gate and are out of this matrix by design.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.4

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ALL_ROLES = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'tenant_staff', 'customer'];

const MAP_SOURCE = path.join(
  __dirname, '..', '..', 'client', 'apps', 'admin', 'src', 'types', 'authorization.ts'
);

/**
 * Reads ROLE_PERMISSIONS out of the TypeScript source. The declaration is a
 * plain object of string arrays, so slicing the literal and normalising quotes
 * and trailing commas is enough — and if the shape ever changes, this throws
 * loudly rather than silently comparing nothing.
 */
function readRolePermissions() {
  const src = fs.readFileSync(MAP_SOURCE, 'utf8');
  const start = src.indexOf('export const ROLE_PERMISSIONS');
  assert.notStrictEqual(start, -1, `ROLE_PERMISSIONS not found in ${MAP_SOURCE}`);

  const open = src.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  assert.notStrictEqual(end, -1, 'unbalanced braces in the ROLE_PERMISSIONS literal');

  const literal = src
    .slice(open, end + 1)
    .replace(/\/\/[^\n]*/g, '')                          // strip line comments
    // Quote the role keys BEFORE touching quotes, and only where a key is
    // followed by `[`. A naive /(\w+)\s*:/ would also match inside the values —
    // 'products:read' would become '"products":read' and blow up JSON.parse.
    .replace(/([A-Za-z_$][\w$]*)\s*:\s*\[/g, '"$1": [')
    .replace(/'/g, '"')                                   // single → double quotes
    .replace(/,(\s*[}\]])/g, '$1');                       // trailing commas

  return JSON.parse(literal);
}

/**
 * Effective role set for one endpoint: every authorizedRoles tag on the
 * router-level `use` layers that precede the route, intersected with the tags
 * on the route's own handler chain. This is exactly how Express composes them.
 */
function enforcedRoles(routerModule, method, routePath) {
  const router = require(routerModule);
  let roles = new Set(ALL_ROLES);
  let found = false;

  for (const layer of router.stack) {
    if (!layer.route) {
      if (layer.handle?.authorizedRoles) {
        roles = new Set([...roles].filter((r) => layer.handle.authorizedRoles.includes(r)));
      }
      continue;
    }
    if (layer.route.path !== routePath || !layer.route.methods[method]) continue;

    found = true;
    for (const sub of layer.route.stack) {
      if (sub.handle?.authorizedRoles) {
        roles = new Set([...roles].filter((r) => sub.handle.authorizedRoles.includes(r)));
      }
    }
    break;
  }

  assert.ok(found, `${method.toUpperCase()} ${routePath} not declared in ${routerModule}`);
  return [...roles];
}

// permission → the single endpoint that backs it.
const BINDINGS = [
  ['products:write',     '../routes/product.routes',     'post',   '/'],
  ['products:delete',    '../routes/product.routes',     'delete', '/:id'],
  ['categories:write',   '../routes/category.routes',    'post',   '/admin'],
  ['categories:delete',  '../routes/category.routes',    'delete', '/admin/:id'],
  ['brands:write',       '../routes/brand.routes',       'post',   '/admin'],
  ['brands:delete',      '../routes/brand.routes',       'delete', '/admin/:id'],
  ['subproducts:write',  '../routes/subproduct.routes',  'post',   '/'],
  ['subproducts:delete', '../routes/subproduct.routes',  'delete', '/:id'],
  ['users:read',         '../routes/user.routes',        'get',    '/'],
  ['users:write',        '../routes/user.routes',        'post',   '/'],
  ['users:delete',       '../routes/user.routes',        'delete', '/:id'],
  ['inventory:write',    '../routes/inventory.routes',   'post',   '/movements'],
  ['inventory:adjust',   '../routes/inventory.routes',   'post',   '/adjust'],
  ['customers:write',    '../routes/contact.routes',     'post',   '/'],
  ['tenant:manage',      '../routes/tenant.routes',      'put',    '/admin/:id'],
  ['orders:write',       '../routes/order.routes',       'post',   '/'],
];

test('ROLE_PERMISSIONS parses out of the TypeScript source', () => {
  const map = readRolePermissions();
  assert.deepStrictEqual(Object.keys(map).sort(), [...ALL_ROLES].sort());
});

for (const [permission, routerModule, method, routePath] of BINDINGS) {
  test(`${permission} matches ${method.toUpperCase()} ${routePath}`, () => {
    const map = readRolePermissions();
    const enforced = enforcedRoles(routerModule, method, routePath).sort();
    const granted = ALL_ROLES.filter((r) => map[r].includes(permission)).sort();

    assert.deepStrictEqual(
      granted,
      enforced,
      `ROLE_PERMISSIONS grants ${permission} to [${granted}] but ` +
      `${method.toUpperCase()} ${routePath} admits [${enforced}]`
    );
  });
}
```

- [ ] **Step 6: Run it and confirm it fails**

```bash
cd server && node --test '__tests__/rolePermissionMap.test.js'
```

Expected 6 failures, all of them faults in the map rather than in the server:
- `users:read` — map grants `tenant_admin` and `tenant_owner`; `GET /api/users` admits `super_admin, admin` only.
- `users:write` — map grants `tenant_admin`; the route admits `super_admin, admin` only.
- `users:delete` — map grants `super_admin` only; `DELETE /api/users/:id` admits `super_admin, admin`.
- `tenant:manage` — map grants `super_admin` only; `PUT /api/tenants/admin/:id` admits `super_admin, admin`.
- `customers:write` — map grants `super_admin, admin`; `POST /api/contacts` admits `super_admin, admin, tenant_owner, tenant_admin`.
- `subproducts:write` — map grants `tenant_staff`; the reachable `POST /api/subproducts` (guarded by `tenantAdminOrSuperAdmin`) does not.

If a binding fails with `not declared in ...`, the route moved — fix the binding, not the assertion.

- [ ] **Step 7: Correct `ROLE_PERMISSIONS`**

In `client/apps/admin/src/types/authorization.ts`, make exactly these edits. Do not touch `super_admin` or `customer` — both already agree.

**(a)** Add a comment immediately above `export const ROLE_PERMISSIONS` (line 45):

```ts
/**
 * What each role may do, as the server actually enforces it.
 *
 * Nothing consumes this map today — the utils/hooks/hoc chain built on it has
 * zero call sites, and so do lib/server-auth.ts's requirePermission and
 * requireAnyPermission. It is kept anyway, and kept true, so that a future
 * server-side permission system has an honest starting point and so that a
 * reader cannot mistake a stale entry for a live authorization hole.
 *
 * server/__tests__/rolePermissionMap.test.js fails if this drifts from the
 * route guards. Read/write permissions here mirror ROUTE-LEVEL role gates only;
 * finer inline rules (super_admin alone may permanently delete a user or delete
 * a tenant) live in the controllers.
 */
```

**(b)** In the `admin` array, after `'users:write',` (line 106) insert:

```ts
    'users:delete', // route-level only — permanent delete is super_admin-gated inline
```

and after `'billing:read',` (line 109) insert:

```ts
    'tenant:manage', // PUT /api/tenants/admin/:id admits admin; tenant *delete* does not
```

**(c)** In the `tenant_admin` array, **delete** these two lines (currently 130-131):

```ts
    'users:read',
    'users:write',
```

and **insert** after `'customers:read',` (line 122):

```ts
    'customers:write',
```

**(d)** In the `tenant_owner` array, **delete** this line (currently 153):

```ts
    'users:read',
```

and **insert** after `'customers:read',` (line 145):

```ts
    'customers:write',
```

**(e)** In the `tenant_staff` array, **delete** this line (currently 163):

```ts
    'subproducts:write',
```

> The reachable `POST /api/subproducts` is guarded by `tenantAdminOrSuperAdmin`, which excludes `tenant_staff`. (`subproduct.routes.js` declares `POST /` a second time around line 1633 with a wider guard, but Express matches the first declaration, so that block is unreachable.) This contradicts the rationale given in the design spec §2.3 for including `tenant_staff` in `POST /api/brands` — the decision itself stands, but the reason was wrong.

- [ ] **Step 8: Run the map test and confirm it passes**

```bash
cd server && node --test '__tests__/rolePermissionMap.test.js'
```

Expected: `# fail 0`.

- [ ] **Step 9: Confirm the admin app still typechecks at baseline**

```bash
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v '^\.next/' | grep -c 'error TS'
```

Expected: `461`. If the count moved, a `Permission` string was mistyped — every value inserted above already exists in the `Permission` union (lines 9-43), so a new error means a typo.

---

## Task 5: Guard-coverage regression test

The durable artifact. It walks every route file, resolves `router.use` globals and guard-array variables — by letting Express resolve them, since a required router already has its composed `stack` — and asserts every mutating endpoint carries an auth guard, with an explicit, commented allowlist for the legitimately public ones.

This is what would have caught the brand hole on the day it was introduced.

Two things the walker must get right, both learned by building it:
- **`appraisal.routes.js` exports an object of four routers** (`{ cycleRouter, appraisalRouter, feedbackRouter, templateRouter }`), not a single router. Handle both shapes or 20 endpoints go unchecked.
- **`optionalProtect` is not a guard.** It attaches a user when a token is present and calls `next()` when it is not, so counting it would wave through guest-checkout and storefront routes. It is deliberately excluded, and the routes that use it are allowlisted by name instead.

**Files:**
- Create: `server/__tests__/routeGuardCoverage.test.js`

---

- [ ] **Step 1: Write the test**

There is no separate red step here — the fix already landed in Task 1, so this test is written to pass. Its value is future regressions: **verify it works by temporarily breaking it in Step 3.**

Create `server/__tests__/routeGuardCoverage.test.js`:

```js
// Every mutating endpoint (POST/PUT/PATCH/DELETE) in server/routes must carry
// an authentication guard, unless it is on the allowlist below.
//
// This exists because five brand-mutation routes shipped under a comment
// reading "// Protected routes (existing)" with no guard at all, and stayed
// that way in production until an audit on 2026-08-07 — an anonymous
// DELETE /api/brands/:id would have deleted a brand. Nothing was watching.
//
// The walk uses the live Express routers rather than parsing source: requiring
// a route file yields a router whose `stack` already has router.use(...)
// globals and guard-array variables (e.g. banner.routes.js's
// `const adminOnly = [protect, authorize(...)]`) composed by Express itself.
// A guard is recognised by function identity against the middleware modules,
// so renaming or rewrapping one cannot fool it.
//
// See docs/superpowers/specs/2026-08-07-roles-permissions-hardening-design.md §2.5

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROUTES_DIR = path.join(__dirname, '..', 'routes');
const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

// optionalProtect is deliberately absent: it calls next() when no token is
// present, so it authenticates nobody. Routes that use it are allowlisted below.
const NOT_A_GUARD = new Set(['optionalProtect']);

/** Every exported middleware that actually refuses an unauthenticated caller. */
function collectGuards() {
  const guards = new Set();
  for (const mod of [
    '../middleware/auth.middleware',
    '../middleware/tenant.middleware',
    '../middleware/pos.middleware',
  ]) {
    for (const [name, value] of Object.entries(require(mod))) {
      if (typeof value === 'function' && !NOT_A_GUARD.has(name)) guards.add(value);
    }
  }
  return guards;
}

// ─── Public allowlist ────────────────────────────────────────────────────────
// Every entry is a mutating endpoint that is unauthenticated ON PURPOSE.
// Adding a line here is a security decision — say why.
const PUBLIC_ALLOWLIST = new Set([
  // Anonymous analytics beacons. No read path, no PII, write-only counters.
  'POST analytics.routes.js /track',
  'POST analytics.routes.js /track/duration',
  'PATCH analytics.routes.js /track/duration',
  'POST analytics.routes.js /track/conversion',
  'POST banner.routes.js /:id/impression',
  'POST banner.routes.js /:id/click',
  'POST sale.routes.js /:id/view',
  'POST product.routes.js /cart/:id',

  // Storefront: a guest must be able to shop before signing in.
  'POST cart.routes.js /validate',
  'POST coupon.routes.js /validate',
  'POST coupon.routes.js /auto-apply',
  'POST order.routes.js /', // guest checkout — uses optionalProtect, not protect

  // Public chatbot on the storefront.
  'POST chatbot.routes.js /greeting',
  'POST chatbot.routes.js /query',
  'POST chatbot.routes.js /escalate',

  // Payment-provider webhooks. Authenticated by provider signature over the
  // raw body, not by a session — a bearer token is impossible here.
  'POST payment.routes.js /webhooks/stripe',
  'POST payment.routes.js /webhooks/paystack',
  'POST payment.routes.js /webhooks/korapay',
  'POST erm.routes.js /webhook',

  // Authentication entry points — by definition reachable without a session.
  'POST user.routes.js /register',
  'POST user.routes.js /login',
  'POST user.routes.js /forgot-password',
  'POST user.routes.js /reset-password/:token', // authenticated by the emailed token
  'POST user.routes.js /verify-email',
  'POST user.routes.js /resend-verification',
  'POST user.routes.js /refresh-token',         // authenticated by the refresh cookie
  'POST user.routes.js /mfa/verify',            // authenticated by the partial MFA token
  'POST verification.routes.js /send-code',
  'POST verification.routes.js /verify-code',
  'POST verification.routes.js /resend-code',
  'POST pos.routes.js /auth/pin-login',
  'POST pos.routes.js /auth/staff-login',

  // Self-service tenant signup: the applicant has no account yet.
  'POST tenant.routes.js /apply',

  // Phone-to-desktop image handoff, authenticated by the one-time :code in the
  // URL that the desktop session generated.
  'POST scan.routes.js /upload-mobile/:code',
]);

/** Walks one router and appends every unguarded mutating endpoint to `out`. */
function walk(file, router, label, guards, out, counter) {
  let globalGuard = false;

  for (const layer of router.stack) {
    if (!layer.route) {
      if (guards.has(layer.handle)) globalGuard = true;
      continue;
    }

    const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]);
    if (!methods.some((m) => MUTATING.has(m))) continue;

    counter.total += 1;
    const routeGuard = layer.route.stack.some((sub) => guards.has(sub.handle));
    if (routeGuard || globalGuard) continue;

    for (const method of methods.filter((m) => MUTATING.has(m))) {
      out.push(`${method.toUpperCase()} ${file}${label} ${layer.route.path}`);
    }
  }
}

function findUnguarded() {
  const guards = collectGuards();
  const out = [];
  const counter = { total: 0 };

  for (const file of fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js')).sort()) {
    const mod = require(path.join(ROUTES_DIR, file));

    if (mod && Array.isArray(mod.stack)) {
      walk(file, mod, '', guards, out, counter);
      continue;
    }
    // appraisal.routes.js exports { cycleRouter, appraisalRouter, ... }
    if (mod && typeof mod === 'object') {
      for (const [key, value] of Object.entries(mod)) {
        if (value && Array.isArray(value.stack)) walk(file, value, `[${key}]`, guards, out, counter);
      }
    }
  }

  return { unguarded: out, total: counter.total };
}

test('every mutating endpoint is guarded, or explicitly allowlisted as public', () => {
  const { unguarded } = findUnguarded();
  const unexpected = unguarded.filter((e) => !PUBLIC_ALLOWLIST.has(e)).sort();

  assert.deepStrictEqual(
    unexpected,
    [],
    'These mutating endpoints accept an anonymous caller. Add a guard, or add ' +
    'the endpoint to PUBLIC_ALLOWLIST with a comment saying why it is public:\n  ' +
    unexpected.join('\n  ')
  );
});

test('the allowlist has no stale entries', () => {
  // A guarded route left on the allowlist would silently excuse the next
  // regression on that same path.
  const { unguarded } = findUnguarded();
  const live = new Set(unguarded);
  const stale = [...PUBLIC_ALLOWLIST].filter((e) => !live.has(e)).sort();

  assert.deepStrictEqual(
    stale,
    [],
    `These allowlist entries are guarded now (or the route moved) — remove them:\n  ${stale.join('\n  ')}`
  );
});

test('the walk actually covered the route tree', () => {
  // Guards against the whole test silently passing because nothing loaded.
  const { total } = findUnguarded();
  assert.ok(total > 400, `expected 400+ mutating endpoints, walked ${total}`);
});

test('the five brand routes that were open are guarded now', () => {
  const { unguarded } = findUnguarded();
  for (const entry of unguarded) {
    assert.ok(
      !entry.includes('brand.routes.js'),
      `brand.routes.js must have no unguarded mutating endpoint, found: ${entry}`
    );
  }
});
```

- [ ] **Step 2: Run it and confirm it passes**

```bash
cd server && node --test '__tests__/routeGuardCoverage.test.js'
```

Expected: `# pass 4`, `# fail 0`. The walk should report 444 mutating endpoints.

If `every mutating endpoint is guarded` fails, read the list it prints: either a guard is genuinely missing, or a legitimately-public endpoint was added since this plan was written and needs an allowlist line with a reason.

- [ ] **Step 3: Prove the test actually catches a regression**

Temporarily reintroduce the bug in `server/routes/brand.routes.js` — add this line just before `module.exports`:

```js
router.delete('/:id', brandController.deleteBrand);
```

Run:

```bash
cd server && node --test '__tests__/routeGuardCoverage.test.js'
```

Expected: **2 failures** — `every mutating endpoint is guarded` naming `DELETE brand.routes.js /:id`, and `the five brand routes that were open are guarded now`.

Now **remove that line again** and re-run:

```bash
cd server && node --test '__tests__/routeGuardCoverage.test.js'
```

Expected: `# fail 0`. Confirm with `git diff server/routes/brand.routes.js` that the temporary line is gone.

---

## Task 6: Full verification against the baselines

**Files:** none modified. This task only runs suites.

- [ ] **Step 1: Run the whole server suite**

```bash
cd server && node --test '__tests__/*.test.js' 2>&1 | tail -20
```

The baseline is 1308 pass / 3 fail of 1311; this plan adds roughly 65 new tests across six files, so expect a pass count in the high 1360s. Do not treat that number as an assertion — `node:test` counts subtests in ways that shift. What matters is:

- **`# fail` is still exactly 3**, and
- the three failures are the pre-existing ones (1 pricelist populate, 2 SO-number) and nothing else.

If `# fail` is higher, identify the new failure before proceeding — a narrowed `adminRoles` may have broken a test that asserted the old wider role set.

- [ ] **Step 2: Run the admin vitest suite**

```bash
cd client/apps/admin && npx vitest run 2>&1 | tail -15
```

Expected: 208/208 passing. You must `cd` in — running from `server/` silently installs vitest 4 and reports "No test files found".

- [ ] **Step 3: Run the admin typecheck**

```bash
cd client/apps/admin && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -v '^\.next/' | grep -c 'error TS'
```

Expected: `461`. Use the `./node_modules/.bin/tsc` path — `npx tsc` falsely reports 0.

- [ ] **Step 4: Confirm the server still boots**

A narrowed guard cannot break boot, but a syntax error in an edited route file can, and `brand.routes.js`, `category.routes.js`, `subcategory.routes.js`, `banner.routes.js` and `auth.middleware.js` were all edited.

```bash
cd server && lsof -nP -iTCP:5001 -sTCP:LISTEN
```

If anything is listening, kill it first — a stale process makes a fresh `npm run dev` print "✅ Server running" while `listen()` silently hit `EADDRINUSE`. Then:

```bash
cd server && node -e "require('./routes/brand.routes'); require('./routes/category.routes'); require('./routes/subcategory.routes'); require('./routes/banner.routes'); require('./middleware/auth.middleware'); console.log('all edited modules load');"
```

Expected: `all edited modules load`.

- [ ] **Step 5: Review the diff**

```bash
git status --porcelain && git diff --stat
```

Expected modified: `server/routes/brand.routes.js`, `server/routes/category.routes.js`, `server/routes/subcategory.routes.js`, `server/routes/banner.routes.js`, `server/controllers/brand.controller.js`, `server/middleware/auth.middleware.js`, `client/apps/admin/src/types/authorization.ts`.

Expected untracked: the six new test files plus the harness, this plan, and the design spec.

**Do not commit and do not push.** Report the diff and the three suite results to the user.
