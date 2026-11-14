# Invoice template layouts

Ten template IDs are registered beside the eight original palette styles. A style is a
presentation choice on the shared DocumentModel renderer. Existing document
kinds and tenant default, family override, and per-export selection continue to
use the same renderer and preference resolution. Financial values and issuer
identity come from the existing adapters.

- `utils/print/templates/registry.ts` and `layout-presets.ts` pair public
  descriptions with settings for the masthead, parties, references, table and
  totals. Keep the server allowlist in sync with the client.
- `pdf-mastheads.ts` composes the new first-page headers. Existing helpers handle
  pagination and draw all line items, totals, notes, and signatures.
- Gallery thumbnails are generated from the actual invoice sample PDF. The invoice
  sample is used in the sales settings preview.

| Layout | Composition |
| --- | --- |
| Letterhead | Issuer across the top, with the invoice title beneath a rule |
| Centred | Centred serif masthead with mirrored billing blocks |
| Split Panel | Two inset panels for issuer and invoice, with an open summary |
| Balance First | Summary before itemisation, with the title on the left |
| Ruled Register | Monospaced register with stacked references and a compact grid |
| Remittance | Invoice banner and a left-aligned settlement summary |
| Folio | Narrow vertical accent with a large title and open parties |
| Boxed Statement | Framed header, shaded party blocks and a full-width summary |
| Banner | Full-bleed invoice heading with a second band for the issuer |
| Compact | Shallow masthead, a tight item table and a minimal summary |

Verification includes stored amounts and party details, first-page geometry,
continuation pages, mixed exports, and server preference validation.

Example exports are in `docs/document-templates/invoice-layouts-catalogue.pdf`.
The admin gallery reads the WebP files under
`client/apps/admin/public/document-template-thumbnails`.

Verified 124 print and preference tests plus nine saved-invoice view tests and
six server template tests. The renderer, sample and gallery card passed scoped
TypeScript checking. Raster inspection and PDF text extraction confirmed ten
A4 sample pages with the expected customer, due date and totals. The full
server suite reported 4,562 passes, 290 failures and 283 skips, including socket,
MongoDB setup, and unrelated route failures. No live tenant save was performed.

## Invoice default in Settings

Add a dedicated Invoices preference under Defaults by document type. Existing
tenants inherit the Sales setting, then the Business setting, when the invoice
preference is unset. The invoice sample and export dialog use the shared
resolver. The server validates the new family through its existing allowlist
and schema. Settings remains scoped to the authenticated tenant.

The Settings test saves through the preferences service mock, reloads Settings,
and opens the shared export dialog with the saved layout. The dialog's temporary
choice leaves the stored preference alone. Server validation and a Tenant schema
check passed. Ship the admin and API updates together. Live tenant saving was
not tested.

## Cross-document layouts

Ten additional mastheads belong in `layout-collection.ts` and
`pdf-collection-mastheads.ts`. The registry and server allowlist expose all 28
styles. Shared table pagination applies to every template. Wide tables repeat
the identifying column when the table needs more than one set of pages. Test
the options against all DocumentModel kinds and actual price-list and stock
adapters, including docs with optional payment, refund, and shipment data.

The new styles are Docket, Panorama, Dispatch, Quarter, Letterpress, Index,
Column, Outline, Proof, and Field Report. The preview sits above the business
gallery and can sample every document family. The A4 catalogue is
`docs/document-templates/additional-layouts-catalogue.pdf`.

Verified 213 focused admin tests, six server preference tests, and a scoped
TypeScript check. All 28 styles were exercised with wide price lists, stock
availability, valuation, RFQs, POs, bills, transfers, and vendor returns. The
new ten were also rendered through the sales quotation, pro forma, and sales
order adapters. Inspected sample invoices and cross-document pages. Live tenant
saving and production deployment were not part of this verification.
