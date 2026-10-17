---
name: Invoice and Sales pricelist speed
description: Batch fresh pricing records and immediately preview pricelist switches.
type: project
---

Shared Sales/invoice pricing uses `salesPricing-data.js` to load distinct
tenant-scoped SubProducts and selected Sizes in two concurrent queries per
request. Mongoose population still performs its normal bounded reference
queries. Tenant and pricelist context load concurrently with these records.
No cross-request price cache: saves and previews always see fresh records.

`use-sales-price-preview.ts` retains sequence/cancellation protection and the
350 ms quantity debounce, but pricelist changes schedule the preview immediately.
Applying an explicit repricing response still suppresses a redundant preview.

Fixtures cover query count, unchanged manual prices, missing products, size
failures, size/product ownership, bundles, freshness and stale preview responses.
20-line simulation with 10 ms/read: sequential ~435 ms, batched ~12 ms with
identical prices. These are simulated timings, not live Atlas measurements.

See `docs/superpowers/specs/RESUME-pricelist-speed.md` for verification.
Keep earlier protections in `sales-pricelist-request-spike.md`.

Final verification: 3,757 server tests passed (6 skipped), 2,775 admin tests
passed. Touched-file lint clean; 359 existing unrelated typecheck errors.
First concurrent suite run timed out on an inventory sorting test; isolated
retry and the full admin rerun both passed. Browser verification remains blocked.

## Dropdown follow-up

The user clarified that opening the dropdown was slow, rather than repricing.
`SalesPricelistSelect` now uses the existing RizzUI listbox so late options render
while it is open. Loading appears in the list and below the field; choices are
disabled while resolving the current context or after a failed lookup. Errors
offer a retry without changing customer/warehouse. Hook cancellation still
prevents old customer responses from replacing current options.

`resolveShopPricelist` loads the warehouse and tenant pricelists concurrently.
No cached option/price responses and no change to allowed/default precedence.
Follow-up suite results are recorded in the resume file.

Dropdown follow-up final verification: 2,779 admin tests passed; 3,758 server
tests passed, 6 skipped; touched-file lint clean. Existing typecheck errors
remain at 359, none in touched files. Fixture confirms options arrive into an
open listbox without reopening and obsolete customer responses are ignored.
