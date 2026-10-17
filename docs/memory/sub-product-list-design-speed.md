---
name: Sub-product list presentation and loading
description: Fifty-row default and opt-in lightweight catalogue reads.
type: memory
---

Default rendered page size is 50 from `utils/sub-product-pagination.ts`, including
POS entry and list/grid/compact views. Valid saved user preferences are preserved.

The complete client-filtered catalogue requests private `view=list` projection.
`server/services/subproduct-list-fields.js` retains fields for all filters, widgets,
CSV and actions but omits operational metadata and rich Size records. Full default
API/detail responses are unchanged. Skip unused backend summary queries in this
mode; widgets compute their current scope locally. Stable ID sort ties preserve
pagination order. JWT tenant authority is unchanged.

1,639-product read-only parity check: full response 7.27MB, lightweight 2.51MB,
65% smaller, all retained field values identical. On October 12, the user requested the earlier card design: grid images are again
4:5 and cover-fit, compact typography/column density and hover actions are restored,
and selection uses the card body. Ready-result entrances remain immediate and
per-card edit prefetching stays disabled.
Pagination controls stay visible on small screens. Focused components remain small.

See docs/superpowers/specs/RESUME-sub-product-list-design-speed.md for validation.

Verified: backend 3,697 passed / 5 skipped; admin 2,707 passed plus four new
card/pagination checks separately. Typecheck remains at 359 pre-existing errors
with no diagnostics in changed list modules. Browser inspection remains unavailable.

October 12 rollback verified with 46 focused card, pagination, filter and catalogue
tests. Fifty-row defaults, lightweight responses and summary widgets are retained.
