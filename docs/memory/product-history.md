# Purchase and sales history — 2026-09-23

See `docs/superpowers/specs/RESUME-product-history.md` for details.

History now loads all API pages with cancellation and retry, sums all matching sales variants, uses purchase unitCost, distinguishes payment states, and fixes filtering/sorting/pagination/selection resets. Headless UI Dialog provides modal behavior; narrow screens use full-width order details. All calls remain read-only and authenticated. Product order value is gross order-line value, not net revenue. Refund totals are explicitly whole-order refunds.

Focused admin suite: 117 tests in 15 files, including 11 history tests. No interactive browser validation (runtime unavailable). Backend untouched. Preserve unrelated uncommitted changes.

Final verification: 117/117 focused tests passed. Full TypeScript check retained 375 existing diagnostics, none in the changed history files. Diff whitespace check passed.

Detail route follow-up: `/sub-products/[slug]` now exposes Purchase history and Sales history through new product-details-history.tsx and history-actions.tsx. They reuse ProductHistoryPanel, pass the loaded SubProduct `_id` and session token, mount only after click, and reset when the record changes. Edit route already shares the updated modal. Verified 119 focused tests, plus final 3/3 action tests after adding signed-out/initial-closed coverage; typecheck remains 375 baseline errors, none in changed files. Browser interaction remains unverified.
