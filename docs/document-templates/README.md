# Document template samples

Eight styles are integrated under **Settings → Document templates**. Each tenant
can save a business default and optional sales, purchases, price-list and stock
defaults. Existing Print/PDF actions open a preview with a temporary style picker.

[View the eight-style PDF catalogue](./template-catalogue.pdf)

| Style | Sample | Character |
| --- | --- | --- |
| Classic | [PDF](./classic.pdf) | Red and gold formal masthead |
| Modern | [PDF](./modern.pdf) | Navy, open spacing, prominent title |
| Editorial | [PDF](./editorial.pdf) | Serif headings and fine burgundy rules |
| Ledger | [PDF](./ledger.pdf) | Compact monochrome grid |
| Signature | [PDF](./signature.pdf) | Green and gold, framed totals |
| Axis | [PDF](./axis.pdf) | Charcoal reference rail and teal details |
| Atelier | [PDF](./atelier.pdf) | Centered serif letterhead and terracotta |
| Blueprint | [PDF](./blueprint.pdf) | Outlined blue modules and numbered party sections |

These samples contain demonstration data, not tenant records. Printing uses the
PDF viewer's print button or Open PDF in a new tab. Bulk invoices can be downloaded
as a single PDF. Thermal receipts and CSV exports keep their current formats.

## Verification (2026-09-08)

Admin: 1,780 tests passed across 108 files. Server: 2,744 tests passed. All eight
actual PDF samples visually inspected. Existing unrelated TypeScript errors
remain elsewhere in the repository; no diagnostics in the template integration.
The live save/reload browser check awaits a working tenant login because the
local sign-in page's displayed test credentials were rejected.
