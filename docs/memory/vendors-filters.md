---
name: Public vendor directory filters
description: /vendors request lifecycle, location filtering and directory-wide sorting, 2026-11-02.
type: project
---

The public /vendors page lists approved Tenants, not external supplier records.
Keep VendorsClient as composition; directory controls, results/cards/hero, types
and useStoreDirectory are colocated in components/Stores.

/api/stores accepts location (city/state/canonicalState) and sort
(products/name_asc/name_desc) before pagination, with a stable _id tie-breaker.
Search strings are escaped literal text. Legacy state/city callers still work.
Default productCount semantics are unchanged; no schema/pricing authority changes.

The hook debounces name and location together, cancels previous requests and
checks request generations. Advance pagination only after success; failed next
pages retain existing cards, and Retry repeats that page. Raw pending input hides
old-query results, but do not throw away the applied query's valid response merely
because input is pending: clearing it before debounce would strand the loader.

Filters have explicit labels, native sort, individual clears, reset-all including
sort, status/error feedback, 16px input text and mobile stacked layout.
Checks: 12 shop/directory + 132 module tests and TypeScript pass; four new API
checks pass. Full server: 4493 pass, 66 test-Mongo setup failures, 258 skips; exact
failure names match the prior shop baseline. Handoff and browser evidence:
docs/superpowers/specs/RESUME-vendors-filters.md. Release client/API together;
no commit/push/deployment in this session.

User follow-up: remove the separate "Browse stores by name" link section from
/vendors. The route now renders VendorsClient only; store cards remain the
directory navigation. StoreDirectoryLinks is no longer mounted by this page.
