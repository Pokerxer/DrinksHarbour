# Inventory locations overview

/inventory/locations renders InventoryLocations. The separate /inventory/configuration/locations page concerns internal zones/aisles/bins and remains outside this overview. Fetch tenant-scoped warehouses + all stock with includeUnstocked. Group stock by warehouse ID; distinct products use SubProduct IDs, and size lines stay separate. Keep zero/negative on-hand, available = on-hand − reserved, and cost value per warehouse line.

Multiple comma/semicolon-separated search names match any location/address/contact or product/SKU/size; type/status/stock filters intersect. Search selects locations; their rows/totals show all their stock, not just searched product rows. Unknown warehouse rows never join arbitrary locations.

No stale or fake zero metrics on partial failure: clear stock, show unavailable, expose retry, disable stock-based controls. Latest authenticated request wins; clear data on sign-out. Keep page full width with no added outer padding.

Handoff: docs/superpowers/specs/RESUME-inventory-locations.md.

## Visual source

User requires the SAME theme/design as /inventory/stock. Match inventory-stock-browser.tsx: single full-width rounded gray panel, compact white toolbar, red #b20202 active tabs/actions, 34px input controls, joined icon summary strip, gray uppercase table headers and compact white table rows. Use the small location toolbar/summary/table modules; do not restore a standalone large heading or disconnected cards.
