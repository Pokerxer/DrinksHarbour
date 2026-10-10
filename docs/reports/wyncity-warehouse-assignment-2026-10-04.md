# Wyn City warehouse assignments

User authorization: assign the 19 products identified in the unassigned-warehouse audit to Wyn City warehouse.

Warehouse: Wyn City (`6a32ad2c78f1e3c27bda089a`).

Applied in one database transaction. All 19 tenant SubProduct warehouse references now point to Wyn City. Added 17 warehouse stock lines with on-hand and reserved quantities both zero. Two products have no size, so only their warehouse references changed. All existing warehouse stock quantities and reservations were checked unchanged before commit. Recorded 19 SUBPRODUCT_WAREHOUSE_ASSIGN audit entries as a system action authorized by the user.

| Product | Size | Previous warehouse reference | New stock record |
| --- | --- | --- | --- |
| Backwoods Authentic Cigar Vanilla | cigar-single | Unset | 6ac28635e2bfeed454ee32a0 |
| Carillonade Cab Sauvignon | 75cl | Unset | 6ac28636e2bfeed454ee32a2 |
| Carillonade Merlot | 75cl | Unset | 6ac28636e2bfeed454ee32a4 |
| Ceres Berry Serenade Fruit Juice Blend | 1L | Unset | 6ac28636e2bfeed454ee32a6 |
| Ceres Guava Fruit Juice Blend | 1L | Unset | 6ac28637e2bfeed454ee32a8 |
| Da Vinci Blueberry Flavoured Syrup | unit-single | Unset | 6ac28637e2bfeed454ee32aa |
| Da Vinci Coconut Flavoured Syrup | unit-single | Unset | 6ac28637e2bfeed454ee32ac |
| Dead Man's Coffee Rum | 70cl | Unset | 6ac28638e2bfeed454ee32ae |
| Digo Samanja | unit-single | Unset | 6ac28638e2bfeed454ee32b0 |
| Dominio Del Rey Sweet Red | No size | Unset | No size; product assignment only |
| Léon Launois Brut | 75cl | Unset | 6ac28639e2bfeed454ee32b3 |
| Léon Launois Prestige | 75cl | Unset | 6ac28639e2bfeed454ee32b5 |
| Léon Launois Rosé | 75cl | Unset | 6ac2863ae2bfeed454ee32b7 |
| Riunite Moscato White | No size | Unset | No size; product assignment only |
| The Famous Grouse Blended Scotch | 35cl | Unset | 6ac2863ae2bfeed454ee32ba |
| The Kurayoshi Japanese Pure Malt | 70cl | Unset | 6ac2863be2bfeed454ee32bc |
| The Kurayoshi Japanese Pure Malt 8 Years Sherry Cask | 70cl | Unset | 6ac2863be2bfeed454ee32be |
| Tomatin 18 Year Oloroso Sherry Cask | 70cl | Unset | 6ac2863be2bfeed454ee32c0 |
| Torraccia Del Piantavigna | unit-single | Unset | 6ac2863ce2bfeed454ee32c2 |

## Fresh verification

```json
{
  "assignedProductRecords": 19,
  "createdStockRows": 17,
  "allCreatedQuantitiesZero": true,
  "remainingUnassignedStockLinesForAuditedProducts": 0,
  "remainingUnassignedStockLinesTenantWide": 0,
  "auditedAssignments": 19,
  "noSizeRows": [
    {
      "name": "Dominio Del Rey Sweet Red",
      "warehouse": "Wyn City",
      "quantity": 0
    },
    {
      "name": "Riunite Moscato White",
      "warehouse": "Wyn City",
      "quantity": 0
    }
  ]
}
```

Verification queried persisted SubProducts, stock records, AuditLogs and the stock service with catalogue completion enabled. The catalogue helper now honors explicit tenant-owned product warehouse references for no-size placeholders; it never creates quantity or accepts a foreign-tenant warehouse.

## Recovery evidence

Each AuditLog changes.before contains the original warehouse reference and existing stock IDs/quantities. changes.after records the created stock ID where applicable. Reversal would require reviewing current references and any subsequent activity first: never delete a created stock record once it carries stock, reservations or later history. No rollback was performed.

Tool: server/scripts/assign-unassigned-wyncity-stock.js. Dry run by default, --apply only for the explicitly authorized assignment. Manifest remains the original historical audit Markdown. Rerunning does not overwrite existing stock quantities.

Assignment verification complete: dry-run scope passed, transaction applied, fresh database/stock-service read confirmed 19 assigned products, 17 zero-quantity stock rows, 19 audit records and zero remaining unassigned stock lines. Full backend regression suite passed: 3,336 tests (`/tmp/wyncity-assignment-server-full.log`); focused catalogue tests 4 passed. Script syntax and diff whitespace checks passed.
