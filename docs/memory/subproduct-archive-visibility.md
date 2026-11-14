# Archived subproducts in current inventory

The private subproduct list defaults to non-archived listings. The admin list can request archived records when an explicit status, quick, advanced, or custom filter calls for them. Current catalog counts and stock warnings exclude archives.

Use the parent SubProduct status to exclude all its sizes from current warehouse stock, count sheets, product on-hand totals, and inventory valuation. Keep warehouse stock and historical transaction records available for restoration and audit. See [the implementation handoff](../superpowers/specs/RESUME-subproduct-archive-visibility.md).

Stock count corrections and venue count capture or review recheck the current listing before recording a count. Reopening the Archived filter still works for a tenant with no current listings.

The shared purchase and sales Catalogue and scan matching exclude archived listings before returning selectable rows. Existing purchase orders retain the listing and size recorded on each line.
