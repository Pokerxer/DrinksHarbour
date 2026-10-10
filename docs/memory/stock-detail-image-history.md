# Stock detail image and history rules

2026-10-04. Handoff: docs/superpowers/specs/RESUME-stock-detail-image-history.md.

StockRow.productImage is nullable; resolve tenant override primary/nonempty URL before the catalogue image for actual ledger and catalogue-placeholder reads. Never fetch an unscoped tenant image. Missing/broken images use the header fallback.

The detail history reads ALL pages for its authenticated SubProduct ID, then defaults to exact movement warehouse ID + size ID. All product moves includes legacy entries without those refs. Never include an opposite transfer leg merely because the selected warehouse is an endpoint. Filter createdAt with inclusive UTC dates; printed/display timestamps use the viewer timezone.

Only confirmed on-hand changes count. Use finite before/after deltas with type/quantity fallback where balances are absent; reservations/releases count zero. Return mirrors reverse stock flow. Pending/cancelled entries stay visible with Not posted. A historical net total is not the current stock balance.

Print uses every matching loaded entry rather than the visible twenty-row preview. Shared DocumentModel + requestDocumentExport preserves tenant branding and existing templates. Disable print during load, error or incomplete pagination. Failed loads clear data and obsolete responses cannot overwrite the selected product; stock-count changes refresh history.

Preserve the full-width page wrapper without outer padding/margins. New detail/history/count modules are small. Full backend 3,337 passed; full admin 224 files / 2,379 passed; final focused stock 110 passed including an 80-entry multi-page PDF test. TypeScript existing 390-error baseline, none in changed modules. No live stock writes or deployment occurred.
