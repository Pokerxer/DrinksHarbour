# Uncommitted review and tenant pages

Date: 2026-09-21

## Tenant administration

The admin tenant area now has complete list, create, detail, and edit flows. The list uses server-persisted deletion and keeps failed rows selected so an operator can retry. System tenants cannot be deleted. Filters cover all current plans, including Growth and Venue.

Tenant forms live under `client/apps/admin/src/app/shared/ecommerce/tenant/`. Keep new form sections small and compose them through `create-tenant.tsx`; do not rebuild the former monolithic form. `use-tenant-record.ts`, `use-tenant-submit.ts`, and `tenant-form-values.ts` are the shared loading, submission, and normalization boundaries.

Lifecycle actions on the detail page require explicit confirmation. Rejections require a reason. The API remains authoritative for tenant isolation and authorization.

The quick-create modal uses `TenantModalSelect` for Plan, Revenue Model, and Status. RizzUI Select portals options to `document.body` by default, which places them outside the global Headless UI dialog's focus boundary and makes them appear unresponsive. Modal selects must use `inPortal={false}`, a local dropdown z-index, `getOptionValue` returning the primitive enum value, and `displayValue` resolving that value back to its label. Keep this behavior centralized in `modal-select.tsx` when adding more dropdowns to the tenant modal.

The edit page exposes tenant access separately from tenant profile data. Approved tenants show a Tenant Admin Login card that opens the existing protected user-creation modal with `tenant_admin` and the current tenant ID fixed by the caller. Resolve those fixed values again at submission time; never trust editable form state for a tenant-scoped role assignment. The existing `/api/users` authorization, MFA, password-strength, duplicate-email, approved-tenant, and audit boundaries remain authoritative. Tenant owner provisioning remains a separate workflow and `Tenant.admin` continues to identify the owner rather than every tenant administrator.

All `/tenants` routes inherit the DrinksHarbour wordmark palette through `TenantBrandTheme`: harbour red (`#dc2626`) for the scoped primary token, white foregrounds, and the dashboard's near-black neutral text. Wrap tenant-owned portal modal content in the same component because it renders outside the route layout and cannot inherit the route variables. Use normal primary buttons for brand actions; reserve RizzUI `danger` for destructive actions such as deletion. Keep light and dark theme classes paired on custom status panels.

## Inventory and purchase returns

Transfer returns must preserve `receivedQty` as receipt history and track reversals in `returnedQty`. Returnable quantity is `receivedQty - returnedQty`. Money reversal uses actual Mongoose subdocument values, removes tax for returned units, and prorates transfer-level delivery charges by the remaining discounted net value.

Vendor returns normalize duplicate product/size rows before adjusting stock. Confirmation adjusts stock before purchase-order or bill counters so insufficient stock cannot leave accounting counters changed. Workflow and inventory-owned fields cannot be changed through the generic PATCH route. The create UI requires a source warehouse.

## Repair scripts

Repair scripts are dry-run by default and require an explicit `--apply` flag for mutation. User-password repair also requires an exact target user ID and a password of at least 12 characters, scopes the lookup to the configured tenant, revokes refresh tokens, and never prints the password.

## Verification baseline

On 2026-09-21 the full server test suite passed. After the tenant-admin login work, the admin suite passed 1,872 tests across 134 files and the admin production build generated all tenant routes, including `/tenants/[id]/edit`. The global strict typecheck still contains unrelated baseline errors; no reported error points to the tenant editor, login assignment, access card, or credential schema files.
