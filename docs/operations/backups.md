# Backup and restore verification

The database is MongoDB. Actual Atlas/hosting backup settings, retention,
encryption, restore permissions, recovery-point objective and recovery-time
objective have not been verified from this checkout. The owner must document
them for the deployed cluster before release or buyer handover.

Use provider-managed snapshots/point-in-time recovery where supported. Keep
exports encrypted, access-restricted and separate from application credentials.
Do not place live dumps, customer exports or media backups in Git or a source
archive. Back up uploaded media/configuration through the relevant provider.

Rehearse restoring a recent backup into a NEW isolated cluster/database with
test-only credentials and outbound mail/payment jobs disabled. Verify tenant
counts, catalog references, order/payment reconciliation, inventory balances,
index integrity and representative read/write flows. Record snapshot time,
restore duration, discrepancies, operator and verification results.

Never test a restore against production or overwrite live data as an exercise.
Repeat after material schema/index changes and at the agreed operational
interval; a backup job completing is not evidence that restore works.
