---
name: accounting-report-disclosure-rules
description: Accounting reports must disclose excluded drafts, mark a GL balance as movement when no from date is set, and colour variance by favourability rather than by sign.
type: convention
---

# Accounting report disclosure rules

Three things a financial report must never let the reader assume. Each was a
silent misstatement before it was a visible one.

## 1. Reports total posted entries only — say how many were excluded

A trial balance that omits 40 pending drafts is indistinguishable from a final
one, and gets signed off. `getTrialBalance`, `getProfitLoss` and `getBalanceSheet`
all carry `draftsExcluded`; render it with `DraftsExcludedNotice`. The trial
balance also carries `entryCount` so the posted scale can be checked against the
draft count rather than "balanced" standing alone.

**Consequence:** a new report endpoint must count drafts too. Silence here reads
as completeness.

## 2. Without a `from` date, a GL "balance" is window movement

`getGeneralLedger` only reads prior entries when `from` is supplied. With no
`from`, `openingBalance` is 0 and `totals.closing` is the sum of window
movements — an account holding ₦5m and moving ₦100k displayed "Closing ₦100,000"
and the running column was headed "Balance".

The payload carries `openingIncluded` (false when `from` was absent). Re-label the
column **Movement**, show the opening chip as "—", and explain why. Do not silently
default a balance to zero.

## 3. Variance colour follows favourability, not the sign of the change

`periodComparison()` sets `row.favourable`; `favourable === null` when unchanged.
Three cases a sign test gets wrong:

- More COGS is worse even though it rose (`HIGHER_IS_BETTER.cogs === false`).
- A loss narrowing from −5,000 to −2,000 improved although nothing "risen".
- A flat figure is neither good nor bad, so it must not be coloured either way.

The arrow shows direction of movement; the colour shows whether it helped. They
deliberately disagree, and the UI says so — do not "simplify" the arrow to match
the colour.

**Also:** a percentage needs a positive base. On a zero or negative previous
figure, print the absolute change instead of `∞`.

**And:** `previousWindow()` returns `null` for an open-ended window. "All time" has
no preceding period, so the comparison table is absent — never a fabricated
baseline. It also shifts by the window's **span**, not by a calendar month, so a
31-day window is not compared with a 28-day one.