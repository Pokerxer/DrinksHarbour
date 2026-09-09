# Document template samples

Eight styles are integrated under **Settings → Document templates**. Each tenant
can save a business default and optional sales, purchases, price-list and stock
defaults. Existing Print/PDF actions open a preview with a temporary style picker.

[View the eight-style PDF catalogue](./template-catalogue.pdf)

| Style | Sample | Character |
| --- | --- | --- |
| Classic | [PDF](./classic.pdf) | Original red and gold |
| Modern | [PDF](./modern.pdf) | Navy and blue |
| Editorial | [PDF](./editorial.pdf) | Burgundy and bronze |
| Ledger | [PDF](./ledger.pdf) | Charcoal and grey |
| Signature | [PDF](./signature.pdf) | Green and gold |
| Axis | [PDF](./axis.pdf) | Charcoal and teal |
| Atelier | [PDF](./atelier.pdf) | Terracotta and sand |
| Blueprint | [PDF](./blueprint.pdf) | Blue and slate |

All eight now share the original slanted masthead, status badge, rounded party
cards, reference cards, compact table, shaded notes and rounded totals panel.
The historical PDF renderer at commit `3c78f3fc` is the design reference.

These samples contain demonstration data, not tenant records. Printing uses the
PDF viewer's print button or Open PDF in a new tab. Bulk invoices can be downloaded
as a single PDF. Thermal receipts and CSV exports keep their current formats.

## Verification (2026-09-08)

Restoration: 57 print tests passed across eight files. All eight actual PDF samples
visually inspected against the historical design. TypeScript still reports 454
existing errors elsewhere; none in the changed template files. Prior integration
baseline: admin 1,780 tests and server 2,744 tests passed. Live tenant save/reload
acceptance still awaits valid credentials; this change concerns presentation.
