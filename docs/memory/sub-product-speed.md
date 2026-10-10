# Sub-product page speed — 2026-10-10

Admin routes are `/sub-products`, `/sub-products/[slug]` and edit/create below that route. Mounted API uses `getMySubProducts` and `getSubProduct` in `server/services/subproduct.service.js`; public `getAllSubProducts` is a different path. Case variants of filenames refer to the same files on this Mac.

List statistics now execute alongside count/records instead of three sequential waits after population. Detail/edit population reuses the first scoped plain document via `SubProduct.populate` with lean references; legacy shipping/warehouse repairs remain, now explicitly ownership-scoped. Real disposable Mongo test verifies one base detail lookup, populated product/tenant/sizes, rejection of another tenant's record, and accurate list count.

Grid/table list images use small Cloudinary derivatives, lazy loading and async decoding; derivative errors retry the original before existing override-to-product fallback. Signed/private/pre-transformed/non-Cloudinary assets stay unchanged. The create/edit history panel loads as a separate chunk only when opened.

Do not Redis-cache complete mutable SubProduct records indiscriminately: stock/pricing and operational fields must stay live. Current list filters still intentionally use up to5,000 records in memory; converting to server-side pagination requires translating every advanced rule and export/grouping behavior first. This session preserves those semantics and does not claim to solve arbitrarily large catalog downloads.

Resume/testing: `docs/superpowers/specs/RESUME-sub-product-speed.md`. Benchmark: `server/scripts/performance-load/sub-product-read-check.js`, localhost disposable fixture only, no .env. No deployment or commit performed.

Verification:117 sub-product admin tests pass; backend3,669 pass/5 skipped; scoped lint0 errors/4 existing warnings. No hosted before/after page timing or clean full admin build claim.
