# Pricelist → Quote Pricing Fixes

> **For agentic workers:** Each task is independent — dispatch fresh subagents in parallel.

**Goal:** Fix correctness gaps in how pricelist affects sales order/quotation pricing.

**Architecture:** Two server-side fixes to `salesOrder.service.js`:
1. Derive `appliedPricelist` snapshot from the actual pricelist doc instead of trusting the client
2. Trigger re-pricing when pricelist changes even without items in the body

**Tech Stack:** Node.js, Express, Mongoose

## Global Constraints

- All tenant-scoped queries MUST use `{ _id, tenant: tenantId }` pattern
- Existing tests must not break (2 pre-existing `generateSalesOrderNumber` failures allowed)
- Follow TDD: write failing test, verify it fails, implement fix, verify it passes

---

### Task 1: Server-derive appliedPricelist snapshot

**Files:**
- Modify: `server/services/salesOrder.service.js` — `createSalesOrderDoc` (~line 301) and `applyEdit` (~line 384)
- Test: `server/__tests__/salesOrder.test.js` (or new file)

**Problem:** Both `createSalesOrderDoc` and `applyEdit` store `body.appliedPricelist` verbatim without verifying it matches the actual pricelist document. A compromised or buggy client could store a mismatched `{ pricelistId, pricelistName }` snapshot on the order.

**Fix:** When `body.pricelist` is provided, look up the Pricelist doc and derive `{ pricelistId: pricelist._id, pricelistName: pricelist.name }` server-side. When `body.pricelist` is null/cleared, set `appliedPricelist` to undefined.

### Task 2: Pricelist-only change re-prices lines

**Files:**
- Modify: `server/services/salesOrder.service.js` — `applyEdit` (~line 384)
- Test: `server/__tests__/salesOrder.test.js`

**Problem:** In `applyEdit`, re-pricing only happens when `Array.isArray(body.items)`. If someone calls the API with only `{ pricelist: "newId" }` (no items), the pricelist reference is updated but line prices remain based on the old pricelist.

**Fix:** After updating `so.pricelist`, if `body.pricelist !== undefined` AND the new pricelist differs from the old one, always re-price (even without `body.items`). Use `recomputeOrderPricing(so, { tenantId })` which uses `so.items` (existing stored items).
