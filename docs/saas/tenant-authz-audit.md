# Sales Module — Tenant Authorization Audit

**Date:** 2026-07-01
**Scope:** Sales module (quotations + sales orders) — controller, service, routes, and the analytics dashboard that surfaces sales/revenue data.
**Standard applied:** `multi-tenant-saas-architecture` non-negotiables, translated from its PHP/MySQL idiom to this stack (Node/Express, Mongoose/MongoDB, JWT auth, `tenant` document field).

Files reviewed:
- `server/controllers/salesOrder.controller.js`
- `server/services/salesOrder.service.js`
- `server/services/salesFulfill.service.js`
- `server/routes/salesOrder.routes.js`
- `server/middleware/auth.middleware.js`
- `server/middleware/tenant.middleware.js`
- `server/controllers/analytics.controller.js`
- `server/routes/analytics.routes.js`

---

## Compliance against non-negotiables

| Non-negotiable (skill) | Stack translation | Status |
|---|---|---|
| Every tenant-scoped query includes `tenant_id` | Every `find/findOne` includes `{ tenant: tenantId }` | ✅ Pass |
| `tenant_id` from session/JWT, never client input | `resolveTenantContext` derives from `req.user.tenant` (JWT, DB-validated); header/query only for super_admin | ✅ Pass |
| Default deny; explicit permission check per action | Sales routes were authenticate-only (no role gate) | ⚠️ Fixed (see F1) |
| Cross-tenant miss returns 404, not 403 | `findOne({_id, tenant})` → 404 on miss across all handlers | ✅ Pass |
| Super-admin actions on tenant data are audited | All super_admin/admin sales mutations logged via `AuditLog` | ✅ Fixed (see F2) |
| Tenant-scoped FKs validated as owned by tenant | `customer`/`warehouseId`/`pricelist` validated against tenant before persist | ✅ Fixed (see F3) |

**Defended well (call-outs):**
- `requireResolvedTenant()` blocks the Mongoose `{ tenant: undefined } → {}` collapse — the most common Node multi-tenant leak — before any tenant-scoped read/write.
- Writes stamp tenant: `createSalesOrderDoc` sets `tenant: tenantId`; `convertQuotationToOrder` copies `quotation.tenant`.
- 404-not-403 is applied consistently, hiding cross-tenant resource existence.

---

## Findings

### F1 — HIGH — Sales routes lacked a role gate  ✅ FIXED
`salesOrder.routes.js` previously ran only `protect, attachTenant`. `attachTenant` is non-blocking, so authorization collapsed to "authenticated + has a tenant claim." End-user roles (`member`, `customer`, `patient`) also carry `req.user.tenant`, so they could list/create/confirm/fulfill their tenant's sales orders.

**Fix applied:** added `tenantUserOnly` to the router chain (owner/admin/staff; super_admin/admin bypass for cross-tenant ops).
```js
router.use(protect, attachTenant, tenantUserOnly);
```
**Follow-up (optional hardening):** if floor staff should not confirm payments or post inventory, split the chain — `tenantUserOnly` on reads/create/send, `tenantAdminOnly` on `confirm`/`fulfill`/`return`/`delete`.

### F2 — HIGH — Super-admin cross-tenant sales mutations are unaudited  ✅ FIXED
A super_admin may target a tenant via `?tenant=<slug>` / `x-tenant-slug` and then `create`/`confirm`/`fulfill`/`return`/`cancel` that tenant's orders — touching inventory, payments, and loyalty — with no record. Violated the non-negotiable that every super-admin action on tenant data is audited with actor, target tenant, and justification.

**Fix applied:** reused the existing `AuditLog` model + `utils/auditLog.js` helper (no new collection needed — it already has the 7-year TTL the skill requires). Added `auditPrivilegedSalesAction(req, action, category, so)` to `salesOrder.controller.js`, called from all 10 mutating handlers. It fires only when `req.user.role ∈ {super_admin, admin}` (the platform roles that can cross tenants; tenant-scoped users act only within their own tenant), and records actor (from `req.user`), `targetType: 'SalesOrder'`, `targetId`, `targetTenantId: req.tenant._id`, `justification: req.body.justification`, plus ip/userAgent. Fire-and-forget: auditing never blocks or fails the request.

Audited actions: `SALES_ORDER_CREATE`, `SALES_ORDER_UPDATE`, `SALES_ORDER_CANCEL`, `QUOTATION_SEND`, `QUOTATION_ACCEPT`, `QUOTATION_REJECT`, `QUOTATION_CONVERT`, `SALES_ORDER_CONFIRM`, `SALES_ORDER_FULFILL`, `SALES_ORDER_RETURN`.

**Follow-up (optional):** to make justification meaningful, have the admin UI send `justification` (e.g. a support ticket ref) on cross-tenant sales actions; the field is captured whenever present.

### F3 — MEDIUM — Client-supplied foreign keys not validated against tenant  ✅ FIXED

**Fix applied:** added `assertTenantOwnedRefs({ tenantId, customer, warehouseId, pricelist })` to `salesOrder.service.js`, called from `createSalesOrderDoc` (all supplied FKs) and `applyEdit` (only the FKs the patch touches, scoped to `so.tenant`). Each present id is checked with `Model.exists({ _id, tenant })` against `POSCustomer` / `Warehouse` / `Pricelist`; a cross-tenant id throws an `Error` with `.status = 400`, which `server.js`'s error handler returns as a 400. Lookups are skipped when there's no live DB connection (consistent with the pricing/promotion engines). Clearing a field to null/'' is allowed and not validated.

Original detail (for context):
`createSalesOrderDoc` / `applyEdit` persist `body.customer`, `body.warehouseId`, `body.pricelist`, `body.appliedPricelist` verbatim. A tenant user could reference another tenant's customer or warehouse id.
- **Pricing** is tenant-scoped in `salesPricing.service` (safe).
- **Warehouse** writes go through `adjustStock(..., tenantId)` / `postShippedStock({ tenantId })`, so a foreign `warehouseId` finds no tenant-scoped stock and **fails to post rather than leaking** — but the order document still stores the foreign reference.

**Recommended fix:** validate ownership before persist, e.g. `Customer.exists({ _id, tenant: tenantId })`, `Warehouse.exists({ _id, tenant: tenantId })`, `Pricelist.exists({ _id, tenant: tenantId })`; reject on miss (404/400). Closes the dangling-reference gap and fails fast with a clear error.

### F4 — LOW — Analytics dashboard  ✅ RESOLVED
`analytics.routes.js` gates `getDashboard` with `tenantAdminOrSuperAdmin`, and `getDashboard` scopes off `req.user.tenant` (JWT) with super_admin → platform-wide `{}` (intentional). No end-user exposure.
**Minor belt-and-suspenders:** `getDashboard` has no `requireResolvedTenant`; the role gate already guarantees tenant context for non-admins, so this is informational only.

---

## Priority queue
1. ✅ **F1** — route role gate (done).
2. ✅ **F2** — super-admin cross-tenant audit logging (done; reused `AuditLog`).
3. ✅ **F3** — tenant-FK ownership validation in `salesOrder.service` (done; customer / warehouse / pricelist).
4. **F4** — optional `requireResolvedTenant` in `getDashboard`.
