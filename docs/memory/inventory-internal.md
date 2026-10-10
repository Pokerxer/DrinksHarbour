# Internal history conventions

Internal history must include transfer-return mirrors stored under category=in/out, using scope=internal at the existing tenant-scoped movement endpoint. Keep tenant/date/product restrictions at the query root and use the same query for pagination/count. Ordinary customer/vendor returns do not qualify without an internal identity.

Separate original transferred in/out from return in/out; include both in net stock change. Count each recorded warehouse leg without collapsing references/products or doubling quantities into a claimed unique transfer count. Return writer can use type=transfer_out: label this Return out, not Return in. Use actual posted balances when available, keep pending quantities separate and disclose missing costs.

From/To filters use directed endpoint IDs and combine with actual warehouse/product/status/date filters. Saved internal views retain route IDs. Full single Internal Transfer Note printing differs from all/multiple Internal transfer history. CSV keeps actual stock warehouse and separate route endpoint names/IDs. No invented invoice tax, link or stock mutation. Keep full-width inventory design without outer spacing; unavailable/partial totals explicit.

Handoff and verification: docs/superpowers/specs/RESUME-inventory-internal.md.

Verified 2026-10-04: 2,438 admin tests and 3,381 backend tests passed; 1 backend test skipped, 0 failures. Focused TypeScript and whitespace checks passed. No authenticated browser verification.
