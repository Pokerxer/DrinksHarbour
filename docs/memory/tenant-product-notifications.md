---
date: 2026-10-08
status: implemented-local-verification-complete
---

# Tenant product notifications

User approved written design and implementation plan on 2026-10-08.
Live admin `/notifications` and header bell now show persisted product alerts.
Backend rules, stock/sales adapters and scheduled jobs create low-stock/out-of-stock,
strong-seller, restock-cover and slow-mover notices. No AI model or external email
provider is used; suggestions are deterministic and show their sales evidence.

Jobs follow production/ENABLE_CRON=true, scan only approved tenants, run stock every
15 minutes and sales at 09:00 Lagos, and queue daily work on overlap. Index creation
adds a partial unique tenant/recipient/dedupKey index before sweeps. Retries preserve
read state; replenishment resolves an episode; later crossings create fresh notices.

Inbox reads/counts/mutations scope JWT tenant and recipient and check current staff
permissions. Platform tenant selection cannot impersonate recipients. Stock respects
warehouse -> Size -> explicit SubProduct source precedence and reservations.
Sales subtract returns and deduplicate linked receipts/fulfillments; undated evidence
suppresses advice rather than claiming no sales. Never multiply sellable units by
pack size. Product approval/rejection now supplies active eligible recipients.
Existing expiry and separate POS feed behavior is preserved.

Operational notes: `server/services/tenantProductInsights.README.md`.
Detailed commands, results and limitations: `docs/superpowers/specs/RESUME-tenant-product-notifications.md`.
Final related backend run: 82/82 passed; frontend feature: 10/10 passed; focused
types passed. Full suite had
two failures in untouched MFA code (new pre-existing identity lookup not mocked),
and two unrelated frontend timeouts that passed on focused rerun. Whole-app types
have existing errors outside notifications. Browser tool failed to initialize;
UI is component/API-tested. No live data, commits or pushes changed.

## POS inbox redesign

The approved page redesign is implemented separately from the shared header list.
See `docs/memory/notifications-page-pos.md` and
`docs/superpowers/specs/RESUME-notifications-page-pos.md` for current page behavior
and final verification; backend notification rules remain unchanged.

## Existing-stock population fix

On 2026-10-08, read-only live inspection found 615 low-stock entries in Wyn City,
5 in UFG Legacy and 124 in CKK Giftery, with no persisted low-stock alerts.
Local cron is disabled. Inbox listing now performs authorized stock-only catch-up
with a one-minute success cooldown and shared concurrent work. Delivery batches
up to 500 atomic upserts and preserves read state. `backfill-stock-notifications.js`
previews by default; `--apply` persists genuine approved-tenant alerts.

Do not use `Notification.createIndexes()` for readiness: live `expiresAt_1` has
legacy non-TTL options and conflicts with the model's TTL declaration. Use
`ensureNotificationDedupIndex()` from `tenantNotificationIndexes.js`, which only
prepares the partial unique tenant/recipient/dedupKey index. No TTL migration or
index dropping is part of this fix. See the RESUME file for final backfill counts
and verification.


Backfill completed: Wyn City 615 stock entries × 33 eligible users = 20,295
alerts; UFG Legacy 5 × 1 = 5; CKK Giftery 124 × 2 = 248. Total 20,548 genuine
recipient-scoped notices. Wyn City's scoped inbox verified 615 total/unread,
50 on page one and zero duplicate episodes. No email, stock or price changes.

Inbox catch-up is per authenticated recipient, not the entire staff fanout;
cache/concurrency keys include tenant and recipient and resolution shares that
scope. Scheduled sweeps still cover all eligible recipients. Final backend run
3,486 passed / 5 skipped / 0 failed (3,491 tests). See resume for index compatibility
and final live verification. No commit or deployment.

Final scoped inbox verification confirmed all three tenants: Wyn City 615, UFG
Legacy 5, CKK Giftery 124, all unread, all with zero duplicate episodes and valid
stock links. These alerts are already saved in the configured database.
