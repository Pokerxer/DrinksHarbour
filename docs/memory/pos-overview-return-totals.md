---
name: pos-overview-return-totals
description: POS dashboard recent-order mapping must import orderReturnTotals and select tip/rounding fields.
type: bugfix
---

# POS overview return totals

`getPOSDashboard` maps recent orders using `orderReturnTotals` from
`services/posReturnTotals.service.js`. Omitting its import causes a ReferenceError
only when recent orders are nonempty. An empty fixture cannot catch the failure.

The recent-orders query must select `tipAmount` and `roundingAmount` as well as
`totalAmount`, `items`, and `refunds`, otherwise commercial sales include staff
gratuities and cash rounding. Query projection matters even when the helper is
covered independently.

`server/__tests__/posDashboard.test.js` invokes the actual controller with model
reads isolated and projections applied. It checks populated/empty orders,
refund deductions, tip/rounding exclusion, and tenant/shop query scope.

See `docs/superpowers/specs/RESUME-pos-overview-return-totals.md` for test results.
