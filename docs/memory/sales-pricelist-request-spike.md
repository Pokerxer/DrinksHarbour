---
name: Sales pricelist update request amplification
description: Preserve loaded metadata and suppress duplicate updates/previews on sales edit.
type: project
---

`/sales/[id]/edit` uses `SalesCreate` and `useSalesCreateForm`.
Update Prices previously replaced draft lines and fetched every distinct
SubProduct again. `sales-repricing.ts` now merges the authoritative response
with existing size/stock/cost/bundle metadata without network requests.
Initial load and warehouse changes still hydrate metadata normally.

The component shares one in-flight save/reprice action. Applying the result
invalidates pending preview responses and records its pricing signature to
avoid an immediate redundant preview. Pricelist lookup receives the normalized
warehouse ID, including orders with populated warehouse references.

Local verification: 139 sales tests pass, including 6 new regression tests.
Full server suite: 2668 passed / 97 failed; route harness failures report null
server.address() when starting test servers. No server code changed.
Admin typecheck fails elsewhere; no diagnostics in changed files.
No production logs inspected and no deployment performed: the Vercel incident
cannot be conclusively attributed to this flow from the supplied alert alone.
See docs/superpowers/specs/RESUME-sales-pricelist-request-spike.md.
