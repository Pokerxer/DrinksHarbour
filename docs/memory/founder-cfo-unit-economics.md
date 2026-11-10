---
name: founder-cfo unit economics
description: founder-cfo skill run against Business Plan v6 inputs, 2026-11-10 — contribution, break-even, year-1 cash need
type: project
---

2026-11-10: Ran the installed `founder-cfo` skill on the Business Plan v6 core stream (Tenant ERM SaaS + marketplace contribution). Files live in `founder/`: `numbers.json` (inputs), `cfo.md` (CFO note + report), `cfo-subscription-only.md`, `cfo-lean-fixed.md` + `numbers-lean.json` (variant), and `cfo-sources.md` (every input's source and estimate flags). All amounts NGN; the tool prints `$`.

Key results, cross-checked against `docs/legal/investors/profit-scenarios.csv` (tool Base profit ₦432k ≈ documented Base ₦437,700 — consistency pass):
- Unit = one paying tenant-month; price ₦50,200 blended (45,000 subscription at the documented ₦45k tenant-mix + 2,200 add-ons + 3,000 marketplace contribution = 3% of ₦100k GMV/tenant); variable ₦5,823; **contribution ₦44,377 (88%)**.
- Base-state fixed ₦4.0m/month → break-even ~90 paying tenants, margin at plan only **9%**. Year 1 as ramped (2 → 100 tenants, ramp is an estimate) loses ₦20.7m; **cash needed ≈ ₦23.3m**, bracketing the documented ₦20–50m funding range.
- Variant with Bear-state ₦2.5m fixed → margin at plan 39%, year 1 −₦2.7m, cash needed ≈ ₦11.4m. Price −10% turns Base margin to −2%.
- Unverified/flagged: startup ₦2m GTM split, the 12-month ramp, and the marketplace ₦3,000 (recorded fact: 2 paying tenants, no online sales; subscription-only break-even ~97 tenants).

Next steps if resumed: replace estimates in `founder/numbers.json` with real GTM quotes and actual receipts; the other 6 revenue streams (ads, loyalty, venue, gifting, distribution) have no modeled assumptions yet; board conditions file (`founder/board.md`) does not exist. Not financial advice; VAT/CIT not modeled.
