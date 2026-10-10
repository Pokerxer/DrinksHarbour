# Transfer list shows tax-inclusive total

2026-10-04. Handoff: docs/superpowers/specs/RESUME-transfer-list-value.md.

/purchases/transfers has Total value, formatted in document currency, with included
tax shown below if positive. Prefer transfer.total (already includes tax and
charges, and updates on returns), then legacy totalValue, then existing transfer
money calculator. Preserve explicit zero. Fallback quantities deduct returnedQty.
Never add taxAmount again to total. Focused value cell tests cover tax double-count
prevention, no-tax, full-return zero, legacy fallback and optional currencies.
