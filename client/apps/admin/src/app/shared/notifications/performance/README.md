# Product sales performance

Dedicated /notifications/performance view uses the existing JWT tenant-scoped
demand API and reports:read guard. Shared shell, filters and request hook retain
refresh/error behavior, abort stale scopes and never accept tenant pivots.

All-location rows come from customer-sales tenant summaries, including dated sales
whose warehouse is unknown. Local rows require warehouse attribution; uncertainty
stays Needs history. Net sales exclude internal transfers and deduct recorded
returns. Complete empty sales evidence is zero; unknown dates/quantities are null.
No stockout-adjusted demand, revenue or trained AI performance claim is invented.

performance-rules classifies weekly comparisons. Prior zero/current positive is
New sales; prior positive/current zero is -100%; unknown/negative/nonfinite values
are incomplete. Fastest/slowest use customer 30-day units; weekly increase/decrease
sorts by unit difference. Unknowns always sort last and ties are stable. Summary
metrics disclose known-entry coverage; all-unknown recorded units say Needs history.

Page owns filters/search/paging; active query/session scope remounts results.
Grid keeps selected key resolved from current rows, updates evidence/permissions
on refresh and permanently clears removed selections. Filters/sort/paging reset
the modal. Cards show actual image, name/size, recorded sales and weekly trend.
Accessible existing core modal handles focus, Escape, backdrop and bounded scroll.
Details show two actual seven-day totals, average speed, evidence caveats and
rule-based suggested next action. They retain exact product/size/location links.

Inventory facts/warehouse link require canSeeStock; restock review requires server
canReviewRestock (fallback canPurchase for older responses); report-only staff see
no stock, cost or supplier fields. No inbox read state/data mutations here.
History periods exclude the current Lagos day, with historyEnd shown as last
included date. No independently duplicated forecasting implementation.

Tests cover sorting/filtering, zero denominator, null history, exact variant links,
report/stock/purchase access, refreshed/removed modal selections, pagination resets,
empty/error states and session/warehouse remounts. See project handoff
RESUME-notifications-performance.md for live evidence and verification.

## POS design and filter improvements — 2026-10-09

PerformanceHeader uses the POS brand tile, red gradient, explicit white title,
warehouse badge and refresh action. Shared notification navigation adds launcher,
brand and underlined permitted active links with horizontal overflow on narrow
screens. Shared InsightShell header slot preserves other feature heroes.

Five icon/accent summary buttons filter all/rising/falling/no-sales/history groups
and expose aria-pressed. Recorded unit card shows known coverage; history has its
own visible review card. Search/warehouse/status/sort share one compact toolbar,
with search clear and result reset. Reset applies search/status/sort within current
warehouse; location changes retain existing shared URL validation and product scope.

Search normalizes accents/case, splits whitespace and requires every token anywhere
across product/SKU/size/location. Most/least sold use known 30-day totals even when
weekly history is missing. Weekly sorts require known changes; unavailable relevant
metrics always sort last. Selected warehouse intersects API rows before search,
filter/sort and paging, protecting against mixed-location response display.
Screenshot reference and verification: RESUME-performance-design-filters.md.

The feature header now wraps `../notification-feature-header.tsx`, shared by the
other notification pages. Performance behavior remains unchanged; cross-page
presentation work is documented in RESUME-notifications-shared-design.md.

Custom timeframe: periodUnits and periodPreviousUnits drive sales/trend sorting,
summary totals, card facts and modal comparison bars. Selected-period trends
compare an equal preceding window. Default 30-day/weekly behavior remains.
A decline to zero appears in both Slowing down and No recorded sales filters.
See RESUME-notifications-timeframe.md for validation and verification.
