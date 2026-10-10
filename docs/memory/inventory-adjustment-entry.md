# Creating warehouse adjustments

Adjustments always target a tenant warehouse, SubProduct and attached Size.
Use the warehouse line's expected current count, never an aggregate product
quantity. Absolute target is whole/nonnegative; zero recount is valid. Protect
reserved units and quarantined lots. Reject unchanged and stale counts. Reason
required; preserve reference/notes and authenticated actor in history.

All updates and both ledgers run in one MongoDB transaction. Size/SubProduct
totals roll up scoped warehouse rows; other warehouses/sizes remain unchanged.
Batch depletion uses that transaction. Cost is captured from standard size/product
cost, with genuine zero preserved and unknown cost omitted. Upward count creates
untracked stock slack, not invented receipt batches.

POST /inventory/adjust uses the new explicit warehouse/count contract; never
restore the removed aggregate/proportional redistribution path. New adjustment
UI uses inventory:adjust permission, supports count/add/remove, local preview,
errors/refresh, focus management and history refresh after confirmed success.
Client retries retain UUID for identical payload. Unique partial tenant/request
ledger index and fingerprint make retries idempotent and reject key reuse with
different details. Existing history rows have no request field and are unaffected.

Handoff/verification: docs/superpowers/specs/RESUME-inventory-adjustment-entry.md.
Plan: docs/superpowers/plans/2026-10-05-inventory-adjustment-entry.md.

Modal follow-up (2026-10-05): quantity clears on warehouse/product/size/mode
changes and count refresh. HTTP 409 requires refresh before another save;
uncertain retries keep their UUID. Validate active warehouse, text lengths,
current/reserved integers and delta overflow. Empty selections/search explain
missing options. See RESUME-adjustment-modal.md for verification and files.
