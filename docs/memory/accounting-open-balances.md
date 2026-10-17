---
title: Accounting open balance aggregation
date: 2026-10-13
status: fixed and verified locally
---

# Accounting open balance aggregation

`/accounting` loads both `arAp.summary` sides. Receivables also include POS
customer tabs via `customerAccount.tabBalances`. Its shared CHARGES, PAYMENTS
and CREDITS expressions were array-wrapped, causing MongoDB error 40237:
"The $sum accumulator is a unary operator". Individual customer balances used
the same invalid expressions, affecting credit-limit and payment checks too.

In a `$group`, use `$sum: { $cond: [...] }`, not `$sum: [{ $cond: [...] }]`.
See [MongoDB accumulator syntax](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sum/).
The fix only removes the array wrappers. Tenant/voided filters, charges less
payments less credits, positive-tab filtering and rounding stay unchanged.

Regression coverage includes all three accumulator query contracts and real
MongoDB execution. The database test is opt-in:

```sh
cd server
DRINKSHARBOUR_ACCOUNTING_TEST_MONGO_URI=mongodb://127.0.0.1:27029/drinks_accounting_test_openbalances node --test __tests__/accounting.openBalances.mongo.test.js
```

Start a disposable local MongoDB on that port first. The test rejects nonlocal
URIs and databases without the `drinks_accounting_test_` prefix. It creates
fixtures, drops that disposable database, and never loads `.env`.
Do not point it at an application database.

Observed before fix: four unit assertions fail and real MongoDB reproduces
40237 in individual balances, the tab directory and AR summary; AP passes.
After fix: 49/49 customer-account, tab fold-in and database checks pass.
Fixtures cover tenant isolation, voided charges, credits, decimal values,
settled/absent customers and the accounting AR/AP summaries.

Full server suite with local socket access: 3,734 pass, 0 fail, 6 skipped
(3,740 tests). The opt-in database regression was run separately and passed.
Sandbox-only HTTP tests cannot bind test ports; use approved local socket access
for the full suite. JavaScript syntax and touched-file whitespace checks pass.
Manual diff review found no additional issue; CodeRabbit CLI is not installed.

No historical data rewrite or deployment required by this code change.
Authenticated browser verification has not been performed.

## Closed monitor connection follow-up

The next reported error was a closed MongoDB monitoring connection, separate
from the invalid aggregation. A read-only ping of the configured database
succeeded in 6.1 seconds on 2026-10-13. The reason for the earlier disconnect
cannot be established from that message alone; reachability has recovered.

`arAp.controller` now uses the existing `withDbRetry` for receivables/payables
summaries and invoice/bill lists. These are read-only operations. A classified
transient connection failure gets one retry after 250 ms. Query errors propagate
immediately, and a second connection failure still surfaces. Existing auth,
tenant filters and payment mutations are unchanged. No persistent database
outage can be repaired by this retry.

The new controller tests exercise first-attempt disconnect recovery for all four
reads, tenant/filter preservation, persistent outage exhaustion and non-connectivity
failure propagation. Focused tests: 65 pass, zero failures. Full server suite:
3,740 pass, zero failures, six opt-in skips (3,746 total). Syntax checks and
touched-file diff whitespace checks pass. Manual diff review found no additional
issue. The fix is local and uncommitted; no deployment or server restart occurred.
Reload `/accounting` after the backend picks up the changed controller.

Subsequent startup failure: see [mongodb-startup.md](mongodb-startup.md).
Startup recovery occurs before accounting handlers can run; no query or payment
mutation can repair a connection that failed during process startup.
