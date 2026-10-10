# Notifications product performance — 2026-10-09

Canonical route /notifications/performance (user called it /performance). Dedicated
small views under shared/notifications/performance replace generic InsightPage
performance branch. Existing tenant demand API, reports permissions and stale-scope
request cancellation remain. All-location summaries use customer net sales; local
rows require complete warehouse evidence. Internal transfers only drive warehouse
demand, never sales rankings. Zero complete sales is No recorded sales; incomplete
history stays null. Backend summaries now include real image and salesDataStatus.

Weekly prior-zero/current-positive is New sales, no infinite percentage. Null and
invalid sales sort last in every mode. Search/segments, fastest/slowest and unit
increase/decrease, 24 per page, summaries with known-total coverage, compact images
and detail modal with actual weekly comparison and rule-based next actions. Exact
product/size/location links and stock/restock facts respect server permission flags.
Removed selection permanently clears; filters/scopes/paging reset detail.

Live read-only Wyn City: 1,145 product sizes; 19 positive customer 30-day sales,
1,126 zero, zero incomplete tenant summaries; 667 real images. Tenant totals can be
complete despite unknown local warehouse history; local forecast restrictions stay.
Through 2026-10-08 Lagos. Leading recorded product sizes: Sunblessed Vinho Tinto /
Branco 84 each, Poliphonia Family Blend Vinho Tinto 48. No data mutation.
Verification and final counts: docs/superpowers/specs/RESUME-notifications-performance.md.
Uncommitted/undeployed. Browser preview unavailable in this session; interactions
are verified with tests, not claimed as visually inspected.

Final verification: backend 3,591 passed/five skipped; dashboard 278 files/2,575
tests passed; focused 12 passed; scoped planning types and feature lint passed.


POS header/filter polish: PerformanceHeader replaces the page hero through shell
slot; shared notification nav adds launcher/logo/active underline. Five clickable
metrics include separate history review, coverage and icon accents. One toolbar
combines warehouse/search/status/sort, clear and reset. Accent/case-insensitive
multi-word search matches across fields; 30-day sales sorts preserve known sales
even with missing weekly trend. Selected warehouse intersects returned rows before
sorting/paging. See RESUME-performance-design-filters.md for verification; no data
changes. Browser initialization failed; no visual-inspection claim.

POS polish verification: dashboard 279 files/2,580 tests and backend 3,591
passed/five skipped; focused 21 passed; scoped types/lint passed. Uncommitted.
