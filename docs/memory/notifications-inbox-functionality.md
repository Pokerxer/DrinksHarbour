# Main inbox corrections — 2026-10-12

Main /notifications keeps opened details after optimistic reading removes a row
from Unread results. Explicit filter changes close it; removal/identity refresh
clears it. Do not resolve selected details from filtered rows. Distinct single
reads use existing hook concurrency; page must not suppress a second opened read.

Search includes public product/size/warehouse/rejection metadata. Coverage reports
actual deduplicated loaded/total for partial or capped windows, with honest local
filter scope. Date-range count labels are scoped. Promotions is a valid safe
internal destination on both server/client; query restrictions still apply.

Handoff: docs/superpowers/specs/RESUME-notifications-inbox-functionality.md.
No generation/authority, dependencies, real tenant mutations or deployment changes.

Verified: backend 3,712 passed / five skipped; admin 2,717 passed in 313 files.
Scoped types, feature lint, formatting/syntax/whitespace passed. Browser preview
unavailable; no visual verification claimed. Work complete, left uncommitted.
