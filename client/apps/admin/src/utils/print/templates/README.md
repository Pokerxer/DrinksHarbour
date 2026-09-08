# Document styles

`registry.ts` is the client source of truth for the eight style IDs and layout
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

Layout files: header/footer (`pdf-layout`), parties (`pdf-parties`), tables
(`pdf-table`), totals (`pdf-totals`). Long tables and paragraphs flow onto pages
with compact continuation headers. `pdf-text.ts` preserves the existing WinAnsi
fallback (₦ becomes NGN in built-in PDF fonts).

Customer price lists use their existing pricing builder for both print and PDF.
The legacy HTML string builder remains for compatibility/tests; active print
controls use the shared PDF preview. CSV and thermal receipt formats are unchanged.

Run the tests from the admin app: `npx --no-install vitest run src/utils/print/`.
Sample generation writes PDFs to `/tmp/document-template-preview`.
