# Expiry alert rules

The existing daily expiry scan runs at 02:00 Africa/Lagos for approved tenants.
Page reads do not scan inventory or recalculate automatic minimum stock. The
separate minimum refresh remains every 12 hours.

Only batches with positive remaining quantity and a valid expiry timestamp in
the tenant warning window qualify (default 90 days, bounded to 1–365). Expired
batches remain actionable until depleted. Quantity is remaining batch stock,
not a claim of sellable availability; quarantined stock requires review.

Delivery uses shared recipient membership/permission checks and deduplicates
per tenant, recipient and batch. Refreshes preserve read state. After successful
delivery, stale and legacy undeduplicated batch alerts are archived. Failed or
oversized scans preserve previous alerts. Scans do not mutate inventory.

Facts come from tenant-scoped batch, SubProduct, size and location records.
Missing references retain the batch alert with safe fallback labels; unrelated
size references are redacted. Prices and supplier details are never selected.
Dates are persisted as ISO strings; legacy BSON dates are also supported.

Expired means expiry timestamp <= current time. Expired/quarantined messages
direct stock review, never depletion or promotion. Legacy messages are corrected
at serialization without triggering a scan. Local dates display in Lagos time.

Expiry filters apply before pagination/counts. Custom ranges use batch expiry
dates, allow future dates, and remain bounded to 366 inclusive days. Expired
includes expired quarantined batches; soon/later exclude quarantined batches.
Chronological aggregation casts identity fields and normalizes mixed stored date
types, putting missing dates last. Alert facts describe the latest scan snapshot.

Regression coverage: expiryScan.job.test.js, expiryDelivery.test.js and
expiryNoticeQuery.test.js under server/__tests__.
