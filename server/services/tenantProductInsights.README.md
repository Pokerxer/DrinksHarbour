# Tenant product notifications

The admin bell and `/notifications` consume `/api/notifications`; all inbox
operations require an active authenticated recipient. A selected tenant never
changes the recipient. Staff categories follow current effective permissions.

`tenantProductInsights.rules.js` holds pure stock and net-sales rules. The stock
adapter uses warehouse stock first, then Size stock, then an explicitly known
SubProduct availableStock. These layers must never be added together. Invalid
warehouse/size references preserve unknown stock rather than create false zeros.
The sales adapter counts settled receipts and paid Sales fulfillments, excludes
linked receipt fulfillments, and allocates Sales returns using existing helpers.
Sellable-unit quantities must never be multiplied by packaging size.
`tenantProductInsights.salesEvidence.js` checks dated coverage; uncertain fulfilled
units suppress sales advice instead of producing an unsupported no-sales claim.

Jobs start with the server's existing production/ENABLE_CRON=true guard. Stock
runs every 15 minutes; sales insights run at 09:00 Africa/Lagos. Daily work queues
behind an overlapping stock sweep. Only approved tenants are scanned. Batches
use 100 products; over 20,000 sales documents aborts that batch rather than
producing partial evidence. Index creation happens before scans without dropping
existing indexes; deploy with notification index creation privileges.

A partial unique tenant/recipient/dedupKey index guards retries. Repeat scans
refresh evidence without resetting read state. Replenished low-stock episodes
archive and release their key so a later crossing creates a fresh notice.
Stale stock resolves only after a complete successful tenant scan; unknown stock
keeps existing episodes. Sales notices deduplicate per product/rule/week.

Existing expiry notices and the separate POS online-order feed retain their
behavior. Product approval/rejection now resolves active tenant recipients.
This feature sends no new emails and changes no stock, prices or orders.

Tests: `server/__tests__/tenantProductInsights*.test.js` and
`tenantNotification*.test.js`; frontend notification service and shared-component
tests. Some HTTP tests require permission to listen on localhost. The admin's
installed Vitest executable can be run directly when pnpm's dependency check
tries to install the existing workspace. See the RESUME file for final results.

## Existing-stock catch-up

Inbox listing now calls `tenantStockAlerts.js` after authorization and option
validation. Only an active, stock-authorized JWT tenant can trigger its approved-
tenant scan; selected platform tenant context never grants inbox authority. A
one-minute successful-scan cooldown shares concurrent requests and bounds its
in-memory tenant/recipient cache. Inbox catch-up generates and resolves alerts
only for that authenticated recipient; scheduled sweeps cover all eligible staff. Failed scans preserve saved inbox records and retry on the
next load. This works even when local scheduled jobs are disabled.

Alert delivery uses unordered batches of at most 500 upserts. Duplicate-key races
retry only failed rows without another insert; other write failures abort the scan
so stale stock episodes cannot resolve incorrectly. Read state remains insert-only.

`node scripts/backfill-stock-notifications.js` previews approved tenants' existing
low-stock entries and eligible-recipient counts, with no alert writes. Add `--apply`
to save genuine stock-only alerts; optional `--tenant=slug` scopes to one approved
tenant. The script does not alter quantities, prices or orders and sends no email.

Index readiness uses `tenantNotificationIndexes.js` to create only the declared
partial unique episode index. Do not replace this with `Notification.createIndexes()`:
the live legacy `expiresAt_1` index has no TTL and conflicts with the schema's TTL
options. TTL migration is separate work; this feature does not drop that index.

Legacy paid POS receipts can lack order-level tenant/linkedSalesOrder. The
`insightReceiptRecovery.js` read adapter uses a unique persisted Sales reconciliation
reference plus matching single-tenant product/size/quantity evidence to recover
these associations in memory. Foreign/conflicting/mixed/ambiguous associations
remain untouched; linked returns and duplicate exclusion use existing helpers.
No transaction dates or warehouse assignments are guessed or written back.
