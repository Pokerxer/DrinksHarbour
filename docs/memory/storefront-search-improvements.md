---
name: Storefront search improvements
description: Requested search refinement and review findings.
type: project
---

## Request and scope — 2026-10-12

User requested search improvements after location-picker refinements. Existing
flow: HeaderSearch opens ModalSearch, ModalSearchContext owns search/suggestions,
and app/search-result/page.tsx handles full results. Preserve central catalogue,
tenant visibility, applied shopping location and explicit sorts.

Read-only findings: suggestion callbacks lack a request generation guard; abort
alone does not prevent older completions/finally handlers changing current state.
loadMoreResults catches failures with console logging only. ModalSearch has an
80ms automatic search delay and several direct search triggers; review duplicate
requests. Components/context exceed project file-size guidance; extract only
sections required by the selected refinement.

Approved bounded design: stable debounced query/suggestions,
stale-result protection when typing/clearing/changing location, visible retry for
search/pagination failures, keyboard/accessibility improvements and clearer
mobile results with seller distance/price consistency. Retain farther sellers.
The user approved implementation with “proceed”. Implemented with regression
tests; no backend catalogue/ranking changes or dependencies.

## Implemented behavior

- Typing immediately invalidates older search requests, including the debounce
  interval; clearing/location changes/unmount also discard late results.
- Suggestions have their own sequence/abort guards, including loading/fallback
  state. Modal uses 250ms debounce and suggestion chips; preset/voice actions no
  longer perform a second duplicate request beside the debounce.
- Pagination errors retain existing results and provide a visible retry. Modal
  exposes Load more drinks. Full results distinguish service failure from zero
  matches, retry the failed page, and show the actual result range/catalogue total.
- Previous/next buttons move one page (formerly jumped to the endpoints).
- Input uses combobox/listbox linkage; empty arrows do nothing, ArrowUp starts at
  the last option, button Enter is not intercepted. Modal traps Tab at the edges,
  handles Escape and restores opener focus.
- Modal prices use shoppingOffer.price; a min/max range is never called a sale.
  Cards in modal show representative seller/distance; full results show the
  active shopping location and nearest-order explanation.

## File structure

Existing context exports stay compatible. UI state moved to ModalSearchUIContext,
suggestions to useSearchSuggestions, recents to useRecentSearches, fetch logic to
useSearchPage, shared types/helpers to search-types/search-data-support. Small
SearchSuggestions and search-price files are beside ModalSearch. Existing large
modal rendering remains otherwise intact; broader redesign is outside this pass.

## Verification and limits

Regression tests reproduce stale-query completion and endpoint-jumping before
fixes; they also exercise clear/location cancellation, suggestion races, retry,
result range, price consistency and keyboard/focus behavior on actual components.
Full storefront suite: 113 passed, 0 failed. Type check retains 19 baseline
diagnostics outside the changed search files. Logs: /tmp/drinksharbour-search-
{tests-final,types-final}.log. No live browser/API smoke test or deployment;
keyboard/component checks use jsdom, with only external dependencies mocked.
Self-review under one-agent rule; preserve unrelated working-tree changes.
