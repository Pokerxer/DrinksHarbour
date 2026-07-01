# Sales Module Phase C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the sales module by wiring server-side search/pagination, fixing all dead buttons with real backend endpoints, decomposing `sales-create.tsx`, and applying UI polish.

**Architecture:** Backend changes to `server/controllers/salesOrder.controller.js`, `server/services/salesOrder.service.js`, and `server/routes/salesOrder.routes.js` — plus new models for activities and custom fields. Frontend changes to `sales-list.tsx`, `sales-create.tsx`, `sales-create-header.tsx`, and the frontend service. Agents are sequenced by file ownership to avoid conflicts.

**Tech Stack:** Node.js/Express (backend), Next.js/React/TypeScript (frontend), MongoDB/Mongoose (models), Paystack (payment links), Resend/SendGrid (email)

## Global Constraints

- All new controllers use `asyncHandler` wrapper pattern from `server/utils/asyncHandler.js`
- All new services use custom error classes from `server/utils/errors.js` (`ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`)
- All new routes use Express `Router()`, `protect` + `attachTenant` + `tenantUserOnly` middleware chain
- Tenant isolation enforced: every query scoped by `tenant: tenantId`, every mutation verified by `requireResolvedTenant`
- Audit logging for privileged sales actions via `auditPrivilegedSalesAction()`
- Frontend service calls use `fetch()` with `authHeaders(token)` and `parseErrorOrThrow()`
- Follow patterns in existing `salesOrder.controller.js`, `sale.controller.js`, `sale.service.js`

---

## File Inventory

### Files to Modify
- `server/controllers/salesOrder.controller.js` — add handlers: search/pagination params, duplicate, import, payment-link, accrued-revenue, activities, email, signature, create-project
- `server/services/salesOrder.service.js` — add service methods for duplicate, import, payment link generation
- `server/routes/salesOrder.routes.js` — add new POST routes for each new action
- `client/apps/admin/src/services/salesOrder.service.ts` — add frontend API methods (duplicate, import, paymentLink, etc.)
- `client/apps/admin/src/app/shared/sales/sales-list.tsx` — wire search/pagination to server, connect import btn, kanban view
- `client/apps/admin/src/app/shared/sales/sales-create-header.tsx` — wire all gear dropdown actions
- `client/apps/admin/src/app/shared/sales/sales-create.tsx` — decompose into smaller files

### Files to Create
- `server/models/Activity.js` — activity/notes model for sales order activities
- `server/models/CustomField.js` — per-tenant custom field definitions
- `client/apps/admin/src/app/shared/sales/hooks/useSalesCreateForm.ts` — form state hook
- `client/apps/admin/src/app/shared/sales/hooks/useSalesAutosave.ts` — auto-save hook
- `client/apps/admin/src/app/shared/sales/SalesCreatePricing.tsx` — pricing section
- `client/apps/admin/src/app/shared/sales/SalesCreateAddresses.tsx` — address section

---

### Task 1: Backend — Search params + Pagination for getSalesOrders

**Files:**
- Modify: `server/controllers/salesOrder.controller.js:46-60` (getSalesOrders handler)
- Modify: `server/routes/salesOrder.routes.js` (no change needed — query params are free)

**Interfaces:**
- Consumes: `parsePagination` from `server/utils/pagination.js`, `paginatedResponse` from `server/utils/response.js`
- Produces: Updated `GET /api/sales-orders` that accepts `?search=&page=&limit=&dateFrom=&dateTo=&warehouse=&paymentMethod=&paymentStatus=` query params

- [ ] **Modify `getSalesOrders` handler** to parse query params, build a MongoDB filter with text search on `soNumber` + `customerSnapshot.name`, date range on `createdAt`, and additional filters for warehouse, paymentMethod, paymentStatus. Use `parsePagination()` for page/limit/skip. Return `paginatedResponse()`.

```javascript
// Inside getSalesOrders handler — replace current implementation
const { docType, status, customer, salesperson, search, dateFrom, dateTo, warehouse, paymentMethod, paymentStatus } = req.query;
const q = { tenant: tenantId };
if (docType) q.docType = docType;
if (customer) q.customer = customer;

// Search across soNumber and customer name
if (search) {
  const s = search.trim();
  q.$or = [
    { soNumber: { $regex: s, $options: 'i' } },
    { 'customerSnapshot.name': { $regex: s, $options: 'i' } },
  ];
}
if (dateFrom || dateTo) {
  q.createdAt = {};
  if (dateFrom) q.createdAt.$gte = new Date(dateFrom);
  if (dateTo) q.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
}
if (warehouse) q.warehouseId = warehouse;
if (paymentMethod) q.paymentMethod = paymentMethod;
if (paymentStatus) q.paymentStatus = paymentStatus;
if (salesperson) q.salesperson = salesperson;
if (status && docType === 'quotation') q.quoteStatus = status;
if (status && docType === 'order') q.orderStatus = status;

const { page, limit, skip } = parsePagination(req.query.page, req.query.limit);
const [data, total] = await Promise.all([
  SalesOrder.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('warehouseId', 'name').lean(),
  SalesOrder.countDocuments(q),
]);
paginatedResponse(res, data, buildPaginationMeta(page, limit, total));
```

- [ ] **Verify** the handler parses params, builds correct MongoDB query, and returns paginated response shape.

---

### Task 2: Backend — Duplicate endpoint

**Files:**
- Modify: `server/controllers/salesOrder.controller.js` — add `duplicateSalesOrder`
- Modify: `server/services/salesOrder.service.js` — add `duplicateSalesOrderDoc`
- Modify: `server/routes/salesOrder.routes.js` — add `POST /:id/duplicate`

- [ ] **Add `duplicateSalesOrderDoc` to `salesOrder.service.js`**: Load the source doc, build a new doc with same fields but new `soNumber`, reset status to `draft`/`'draft'`, clear `fulfillments`, `convertedFrom`, `convertedTo`, `relatedInvoice`, `paymentStatus`, `amountPaid`, `walletTxRef`, `loyaltyEarned`, `loyaltyRedeemed`, `pointsRedeemed`. Reset each line's `fulfilledQty`, `postedQty`, `returnedQty` to 0. Return the new doc after `save()`.

- [ ] **Add `duplicateSalesOrder` to controller**: Resolve tenant, load source, call service, audit, return 201.

- [ ] **Add route**: `router.post('/:id/duplicate', duplicateSalesOrder);`

---

### Task 3: Backend — Import CSV endpoint

**Files:**
- Create: `server/controllers/salesImport.controller.js`
- Create: `server/services/salesImport.service.js`
- Modify: `server/routes/salesOrder.routes.js` — add import route
- Uses: `server/utils/csvParser.js`

- [ ] **Create `salesImport.service.js`**: 
  - `parseSalesCsv(csvText, tenantId)` — parse CSV rows into sales order objects
  - `bulkImportSales(orders, tenantId)` — iterate orders, call `createSalesOrderDoc` for each, return { created, errors }
  
- [ ] **Create `salesImport.controller.js`**:
  - `importSalesOrders` — accept multipart/form-data with CSV file, call service, return results

- [ ] **Add route**: `router.post('/import', upload.single('file'), importSalesOrders);`

---

### Task 4: Backend — Payment Link, Accrued Revenue, Create Project

**Files:**
- Modify: `server/controllers/salesOrder.controller.js` — add 3 handlers
- Modify: `server/routes/salesOrder.routes.js` — add 3 routes

- [ ] **Generate Payment Link** (`generatePaymentLink`):
  - Load the order, verify it's an unpaid order
  - Generate a Paystack payment link for the order total
  - Store `paymentLink` on the order and return the URL

- [ ] **Accrued Revenue Entry** (`accruedRevenueEntry`):
  - Create a journal entry via `journalEntry.service.js` for the order's revenue
  - Mark the order as having accrued revenue recorded

- [ ] **Create Project** (`createProjectFromOrder`):
  - Create a simple task/project record linked to the order
  - Return the created project

---

### Task 5: Backend — Activities + Custom Fields models + endpoints

**Files:**
- Create: `server/models/Activity.js`
- Create: `server/models/CustomField.js`
- Modify: `server/controllers/salesOrder.controller.js` — add activity/custom-field handlers
- Modify: `server/routes/salesOrder.routes.js` — add routes

- [ ] **Create `Activity` model**: fields: `tenant`, `salesOrder`, `type` (note, call, email, meeting), `subject`, `description`, `createdBy`, `createdAt`. Indexed by `{ tenant, salesOrder }`.

- [ ] **Create `CustomField` model**: fields: `tenant`, `model` ('SalesOrder'), `fieldName`, `fieldType` (text, number, date, select), `options` (for select), `isRequired`, `createdBy`.

- [ ] **Add controller handlers**:
  - `getActivities` / `createActivity` — CRUD for order activities
  - `getCustomFields` / `setCustomFieldValue` — custom field management

- [ ] **Add routes**: `/api/sales-orders/:id/activities`, `/api/sales-orders/custom-fields`

---

### Task 6: Backend — Send Email + Request Signature

**Files:**
- Modify: `server/controllers/salesOrder.controller.js` — add handlers
- Modify: `server/routes/salesOrder.routes.js` — add routes
- Uses: `server/services/email.service.js`

- [ ] **Send Email** (`sendOrderEmail`): Load order, compose email with order details as HTML table, send via `email.service.js`. Update `emailSent` flag on order.

- [ ] **Request Signature** (`requestSignature`): Generate a signature request token, send email with signature link, store token on order.

---

### Task 7: Frontend — sales-list.tsx search + pagination + import + kanban

**Files:**
- Modify: `client/apps/admin/src/app/shared/sales/sales-list.tsx`
- Modify: `client/apps/admin/src/app/shared/sales/sales-list-helpers.ts`
- Modify: `client/apps/admin/src/services/salesOrder.service.ts` — ensure list params are properly typed

- [ ] **Wire server-side search**: Replace client-side filter with debounced search input that calls `salesOrderService.list()` with `search`, `page`, `limit`, `docType`, `status` params. Add `useEffect` to reload on param change.

- [ ] **Wire pagination**: Use `page` and `totalPages` from response. Update pagination controls to call `setPage(p)` and reload.

- [ ] **Wire import button**: Call `salesOrderService.import()` with selected CSV file via file input.

- [ ] **Wire kanban view**: Render proper kanban board with columns grouped by `orderStatus`/`quoteStatus`, cards showing `soNumber`, `customerSnapshot.name`, `total`, status badge.

---

### Task 8: Frontend — sales-create-header.tsx all buttons

**Files:**
- Modify: `client/apps/admin/src/app/shared/sales/sales-create-header.tsx`
- Modify: `client/apps/admin/src/services/salesOrder.service.ts` — add new API methods

- [ ] **Wire Mark as Sent**: Call `salesOrderService.send(id, token)`, toast on success.

- [ ] **Wire Duplicate**: Call new `salesOrderService.duplicate(id, token)`, navigate to the new order.

- [ ] **Wire Share**: Copy order URL to clipboard via `navigator.clipboard.writeText()`.

- [ ] **Wire Generate Payment Link**: Call `salesOrderService.generatePaymentLink(id, token)`, open the returned URL.

- [ ] **Wire Accrued Revenue Entry**: Call `salesOrderService.accruedRevenue(id, token)`, toast result.

- [ ] **Wire Create Project**: Call `salesOrderService.createProject(id, token)`, navigate to project.

- [ ] **Wire Send Email**: Call `salesOrderService.sendEmail(id, token)`, toast result.

- [ ] **Wire Request Signature**: Call `salesOrderService.requestSignature(id, token)`, toast result.

- [ ] **Wire Knowledge**: Open help URL in new tab.

- [ ] **Wire Spreadsheet**: Toggle spreadsheet view (read-only grid).

---

### Task 9: Frontend — Decompose sales-create.tsx

**Files:**
- Create: `client/apps/admin/src/app/shared/sales/hooks/useSalesCreateForm.ts`
- Create: `client/apps/admin/src/app/shared/sales/hooks/useSalesAutosave.ts`
- Create: `client/apps/admin/src/app/shared/sales/SalesCreatePricing.tsx`
- Create: `client/apps/admin/src/app/shared/sales/SalesCreateAddresses.tsx`
- Modify: `client/apps/admin/src/app/shared/sales/sales-create.tsx`

- [ ] **Extract `useSalesCreateForm` hook**: Form state management, field setters, validation, dirty tracking.

- [ ] **Extract `useSalesAutosave` hook**: Auto-save logic, debounced save, conflict detection.

- [ ] **Extract `SalesCreatePricing` component**: Pricing section with totals, discounts, taxes display.

- [ ] **Extract `SalesCreateAddresses` component**: Invoice + delivery address blocks.

- [ ] **Rewrite `sales-create.tsx`**: Import hooks + sub-components, compose together, keep under 300 lines.

---

### Task 10: UI polish

**Files:**
- Modify: `client/apps/admin/src/app/shared/sales/sales-list.tsx`
- Modify: `client/apps/admin/src/app/shared/sales/sales-order-detail.tsx`
- Modify: `client/apps/admin/src/app/shared/sales/sales-order-detail-info.tsx`
- Modify: `client/apps/admin/src/app/shared/sales/sales-quotation-detail.tsx`
- Modify: `client/apps/admin/src/app/shared/sales/sales-quotation-detail-info.tsx`
- Modify: `client/apps/admin/src/app/shared/sales/sales-helpers.ts`
- (plus all other sales files using `#b20202`)

- [ ] **Replace `#b20202`** with Tailwind semantic class `text-primary`/`bg-primary`. Search all sales files for the hardcoded hex.

- [ ] **Deduplicate `fmtDate`**: Remove local definitions in `sales-order-detail.tsx` and `sales-order-detail-info.tsx`, import from `sales-helpers.ts`.

- [ ] **Fix pagination label**: Change `'80+'` to `'80+'` only when total exceeds current page results.

- [ ] **Fix `eslint-disable` comments**: Remove unnecessary suppressions, fix hook deps where possible.

---

## Execution Order

Due to file conflicts, execute these tasks in 3 phases:

**Phase 1 — Backend (sequential, one agent per task to avoid controller/routes conflicts):**
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6

**Phase 2 — Frontend (parallel where files don't overlap):**
Task 7 (sales-list.tsx) | Task 8 (sales-create-header.tsx) | Task 9 (sales-create.tsx decomposition)

**Phase 3 — Polish (can run after all others):**
Task 10 (UI polish across all files)
