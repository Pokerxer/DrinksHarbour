# Marketplace warehouse selection

Tenants can select active, owned locations in Settings → Warehouses → General. The authoritative setting is the ordered `Tenant.warehouseSettings.marketplaceWarehouses` list. Records created with the original single location retain it until saved with the new picker. An empty list restores existing stock behaviour.

The marketplace combines sellable stock for each SubProduct and retail Size across the selected active locations. Reserved stock and ineligible batches are excluded. If one warehouse becomes unavailable, the other selected active warehouses can still sell.

Marketplace checkout reserves each line at the tenant's active default warehouse. It uses the warehouse in Settings first, then an active location marked default when the settings field is blank. An inactive configured default, missing default, or insufficient stock prevents marketplace checkout. Existing orders keep their warehouse snapshots and the separate storefront integration uses its channel warehouse. See [the implementation handoff](../superpowers/specs/RESUME-marketplace-warehouse.md) for verification.

Cart validation uses selected marketplace stock. The checkout page requests default-warehouse validation immediately before payment and uses its own result to show checkout quantity limits or warehouse unavailability.
