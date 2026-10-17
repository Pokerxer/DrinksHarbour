# Sales catalogue picker — 2026-10-15

The shared sales create/edit/invoice catalogue lazily mounts on first opening.
It uses an accessible Headless UI dialog, compact product cards, responsive
searchable filters, paging, direct quantities, live order summary and explicit
loading/empty/error/retry states. Warehouse (including populated references) and
order currency are passed by SalesCreateOverlays.

`GET /api/subproducts?view=catalogue` uses the existing authenticated route and
tenant authority. `server/services/sales-catalogue.js` handles full-catalogue
search/filter/sort/count/facets with a default 24-row page (cap 48), minimal
projections and no dashboard statistics. Ordinary pages join sizes and warehouse
stock after pagination; global variant search and price/stock sorting opt into
the earlier joins needed for correct results. Availability subtracts reservations
and clamps at zero. Foreign-tenant warehouses are rejected.

`use-sales-catalogue.ts` issues one opening request, debounces search, aborts old
requests, guards scope/late responses, and retains at most eight per-mount pages.
Reopen revalidates stock; cached controls stay disabled until fresh. Refresh
also clears cached facets. No persistent browser cache or backend stock cache.

`sales-catalog-pricing.ts` reuses the existing pricing engine for displays and
selection, fixing sizeless pricelist omission and preserving variant pack sizes.
Stock/price data remain server-authoritative when the sale is saved/confirmed.

Handoff: `docs/superpowers/specs/RESUME-sales-catalogue-modal.md`.

Follow-up: the user requested multi-product search, more width, and selecting
out-of-stock products. `sales-catalog-search.tsx` retains Enter/comma-separated
phrases as removable chips; Backspace on an empty input removes the last term.
Backend combines phrases with OR across names, SKUs and barcodes, keeping tenant
and other filters in force and escaping regex syntax. Dialog maximum is now
1600px. Add buttons allow zero-stock products and sizes; stock labels remain,
and pending requests still disable stale controls. Reservation/confirmation
rules are unchanged.

The wider modal must not stretch product cards: use 266px auto-fill columns for
both cards and skeletons, shrinking only when the container is narrower.

Image visibility: the image area is now 208–224px tall with 8px padding;
object-contain keeps whole bottles visible. Cloudinary derivatives are 480px
for sharp labels at this larger display size. Card width remains 266px.
