# Document styles

`registry.ts` is the client source of truth for the twenty-eight style IDs and layout
tokens. The API validates the same IDs in `server/config/document-templates.js`;
update both registries together when adding a style.

Keep financial content in DocumentModel builders. The renderer and template
modules must not recalculate tax, discounts, purchase totals, or price-list rules.
`templateId` on a model is explicit and immutable for that render. No global
palette or localStorage tenant preferences are allowed.

Existing print helpers call `requestDocumentExport`, consumed by the root
DocumentExportHost. Its dialog loads preferences for the authenticated tenant,
allows a temporary override, previews the real PDF, and exports individual or
combined PDFs. Tenant/user scope changes discard the dialog and form state.
Settings saves require `settings:write` on the server. Inactive/read-only tenant
restrictions remain enforced by the existing tenant guard.

Saved accounting customer invoices use `customer-invoice.ts` and this same
template/preview flow. Build from frozen CustomerInvoice details, not live source
orders; never reprice lines or replace invoice numbers with Sales/POS references.

Layout files: original header and shared footer (`pdf-layout`), new mastheads
(`pdf-mastheads`), parties (`pdf-parties`), references (`pdf-meta`), tables
(`pdf-table`) and totals (`pdf-totals`). Long tables and paragraphs flow onto pages
with compact continuation headers. `pdf-text.ts` preserves the existing WinAnsi
fallback (₦ becomes NGN in built-in PDF fonts).

Customer price lists use their existing pricing builder for both print and PDF.
The legacy HTML string builder remains for compatibility/tests; active print
controls use the shared PDF preview. CSV and thermal receipt formats are unchanged.

Run the tests from the admin app: `npx --no-install vitest run src/utils/print/`.
Sample generation writes PDFs to `/tmp/document-template-preview`. The gallery
uses first-page 425×600 WebP renders of those sample invoices, in
`public/document-template-thumbnails`. Regenerate the matching images after a
layout or sample change.

## Original design restoration (2026-09-08)

The user requested the design from before the template system. The reference is
`3c78f3fc:client/apps/admin/src/utils/print/pdf-render.ts`. The first eight IDs share
that slanted 104pt masthead, department/status badges, accented rounded party
cards, individual metadata cards, compact grid, rounded totals and notes panels.
Only the palettes differ; Classic is the original red/gold. Gallery thumbnails
and docs/document-templates PDFs must match. Those styles use Helvetica and common spacing.
Retain current pagination and tenant-authoritative issuer data; do not restore
the historical fallback that put a platform address on a tenant's letterhead.

## Additional layouts (2026-11-14)

Ten additional IDs use the compositions in `layout-presets.ts` and
`pdf-mastheads.ts`. They are available as business or family defaults and as
per-export overrides. The Invoices setting controls A4 invoice exports and falls back to
Sales, then Business default. The preview opens on the invoice sample. Balance First places the existing summary before the items. Remittance
places it on the left. Empty or long sections follow the shared pagination
rules. See the ten-layout catalogue in `docs/document-templates`.


## Cross-document layouts

The second collection defines presets in `layout-collection.ts` and mastheads
in `pdf-collection-mastheads.ts`. Layouts use the document's title and optional
content. Dense tables use `pdf-table-widths.ts` to reserve space for identifiers
and values. The Product column always repeats across column groups, with Size
and Warehouse where the adapter marks them as identifying columns. Column and
row continuations both use the shared headers and per-document page numbers.
