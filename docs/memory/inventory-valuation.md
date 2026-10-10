# Inventory carrying value vs issue price

StockRow.costPrice preserves next FIFO issue price and existing pricing semantics. For reports use finite StockRow.stockValue when provided; legacy rows fall back to signed quantity × costPrice. valuationUnitCost is average carrying value/unit and can differ from the issue price.

server/services/stockValuation.js computes location/size carrying values from remaining FIFO layers or weighted batch costs. Standard cost fills uncovered/unpriced quantities; estimates, missing costs and batch/on-hand mismatches are explicit. Negative stock is a signed standard-cost estimate. Reserved AND quarantined on-hand stock carry cost; quarantine remains excluded from next-issue pricing/expiry checks.

Screen, groups, stock/valuation CSV, PDF and inventory location totals use the shared lineValue. CSV preserves original Unit Cost and adds Carrying Unit Cost/source/estimate metadata. Valuation table sorts its carrying-cost column on displayed costs and saves method sorts. Shared data hook includes zero catalog lines in stock AND valuation modes.

Keep the inventory/stock theme. No historic financial balance claims: this reports CURRENT on-hand, not ledger reconciliation. Handoff: docs/superpowers/specs/RESUME-inventory-valuation.md.
