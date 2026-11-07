# Business-specific variants

The DRI-1 worktree already had an in-progress retail variant implementation when
the task began. The tenant-owned Size row is the purchase identity for
size, colour and named-option combinations. Use the existing separate venue
serving identity. See the [DRI-1 resume spec](../superpowers/specs/RESUME-business-specific-variants.md)
for the verification baseline, marketplace checkout verification and migration prerequisites.

Use `sellWithoutSizeVariants` to identify the explicit sizeless sale mode.
These listings may still have a default Unit Size for warehouse receiving.
Both marketplace checkout and the tenant storefront cart check the flag when
a line omits its Size. Legacy stock reservation requires the flag on the
aggregate write as well; release does not depend on the current listing mode.
A supplied retail Size must belong to the listing and its tenant. Warehouse
mapping continues to require an exact stock row.

## DRI-2 acceptance checkpoint

The expansion handoff records 88 passing focused backend checks. The isolated
browser, MongoDB and till journeys remain open. Run the fixtures and capture
the exact Size IDs and stock deltas before accepting the issue. See
[DRI-2 acceptance checklist](../superpowers/specs/RESUME-paperclip-business-expansion.md).

The 2026-11-05 board continuation repeated the 88 focused backend checks and
20 targeted admin checks successfully. POS source review found that the normal
sale requires a tenant-owned POS warehouse and issues stock by the selected
Size ID. This runner still denies local listeners with `EPERM`; the real
database, browser and till acceptance remains open. The resume spec records
the exact remaining fixtures and the Paperclip tool-access limitation.

The later operator MongoDB pass found that SalesOrder's sparse marketplace
bridge index rejected a second manual order with a null marketplace order ID.
DRI-2 now declares a partial ObjectId index and includes a preview-first
replacement script. A disposable replica confirmed manual orders coexist,
duplicate marketplace bridges are rejected, and the full sales reservation
integration test passes. Existing databases still need a separately authorized
index migration before release; browser and till acceptance remain open.
