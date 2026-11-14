# Reusing a size barcode from an archived listing

A nonempty Size.barcode is a tenant-scoped lookup key. When another size requests it, the application checks the owning SubProduct status. An archived owner releases the key and retains the value as archivedBarcode. The existing unique index arbitrates concurrent claims and continues protecting current listings. This works with legacy archives without a backfill or index replacement.

The listing editor now saves explicit barcode clears by unsetting Size.barcode. A missing barcode field preserves the saved value. A replacement is trimmed and checked for conflicts within the tenant. MongoDB regressions cover replacement, clearing, reuse of the released barcode, and removing an unused size while protecting sizes with current stock or past stock movements.
