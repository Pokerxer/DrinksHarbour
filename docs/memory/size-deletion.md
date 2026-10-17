# Delete unused saved sizes — 2026-10-15

The sub-product edit size trash button checks the authenticated
`GET /api/subproducts/:id/sizes/:sizeId/deletion` endpoint and confirms removal
from the form. Product save applies deletion. Check failures keep the size.
Clear-all is restricted to unsaved sizes; saved sizes need individual checks.

`server/services/size-deletion.js` is the shared deletion policy for product
saves, switching to single-item mode, and direct DELETE. Stock/reservations,
sales counters, historical documents (including invoices/drafts/cancelled
records), and live references block deletion. Empty WarehouseStock rows alone
are removable. Keep the explicit reference paths in sync with model changes.
Tenant ownership is checked through the parent and Size; tenantless historical
collections are searched using that already-authorized size identity.

Product saves check before writing edits and again before removal; deleting a
default picks a remaining size or clears it. Single-item saves preserve an
existing Unit id so history remains linked.

Handoff and verification: `docs/superpowers/specs/RESUME-size-deletion.md`.
