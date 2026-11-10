# CFO input sources — DrinksHarbour unit economics

As of 2026-11-10. All amounts NGN (the tool prints `$`; read it as NGN throughout). Revenue figures are before VAT — the reports do not model Nigerian VAT (7.5%) on top of listed prices.

## Where each number comes from

In priority order per the skill rules: user/plan-of-record documents first, then checkable public prices, then clearly-marked estimates.

| Input | Value | Source | Category |
|---|---:|---|---|
| `price` = 50,200/tenant-month = 45,000 subscription + 2,200 add-ons + 3,000 marketplace contribution | Blended | Subscription price 45,000 and add-on revenue 2,200/tenant: `docs/legal/investors/valuation-assumptions.md` (tenant-mix-weighted: 20% Starter ₦15K, 40% Growth ₦35K, 30% Pro ₦65K, 10% Enterprise ₦85K; mix direction confirmed in plan ladder `server/config/erm-plans.js`) | Plan-of-record assumption |
| Marketplace contribution ₦3,000/tenant-month = 3% of ₦100,000 GMV/tenant | 3% of GMV contribution, GMV ₦10m/month at Base ÷ 100 tenants | `docs/legal/investors/valuation-assumptions.md` (marketplace contribution after processing 2%, subsidy 3%, refunds 1%, acquisition 2%) | Plan-of-record assumption; **unproven — recorded fact is two paying tenants, no online sales yet** |
| Payment processing ₦823/tenant-month = 775 subscription fee + 48 add-on fee | Paystack local: min(1.5% + ₦100, 2,000), ₦100 waived below ₦2,500 | `docs/legal/investors/valuation-assumptions.md` → [Paystack Nigeria pricing](https://paystack.com/pricing) | Publicly checkable |
| Variable service ₦5,000/tenant-month | Support + incremental infrastructure | `docs/legal/investors/valuation-assumptions.md` | Plan-of-record assumption |
| Fixed monthly ₦4,000,000 total | Staff/founder ₦2.0m, B2B sales & marketing ₦0.8m, engineering/security maintenance ₦0.7m, hosting/admin ₦0.5m | Total 4.0m is the documented Base-state fixed cost (`valuation-assumptions.md`, "staff/founder pay, baseline hosting, administration and B2B sales/marketing", including continuing development); the four-way split is my estimate to fit the `variable`/`fixed` line-item format | Total: documented; split: **estimate** |
| Lean variant fixed ₦2,500,000 | Bear-state fixed cost | `profit-scenarios.csv` "Bear, 25 tenants, 2,500,000" | Documented scenario |
| Startup ₦2,000,000 (GTM marketing 1.2m, registration/legal 0.35m, sales tooling 0.25m, domain/payments/security setup 0.2m) | One-off go-to-market spend | **My estimate.** The platform build itself is sunk (rebuild estimate ₦40–75m in `valuation-assumptions.md` is NOT future cash and is excluded). No recorded GTM budget on file; replace with real quotes when available | Estimates — flagged |
| `ramp_per_day`: 2 → 4 → 8 → 14 → 22 → 32 → 45 → 58 → 70 → 80 → 88 → 95 → 100 paying tenants (÷30 for units/day) | Year-1 tenant ramp | **My estimate.** Anchors: starts at the user-confirmed 2 paying tenants; ends at the documented Base state of 100 tenants. No recorded cohort/panel data (`founder/panel/results.md` does not exist for this project) — month 1 growth rate is judgment, not data | Estimates — flagged |
| `plan_per_day` = 3.33 (100 tenant-months/month) | Base state | `profit-scenarios.csv` "Base, 100" | Documented scenario |
| Break-even ≈ 90 paying tenants | Computed | 4,000,000 ÷ 44,377 ÷ 30 = 3.0 tenant-months/day | Tool output |
| Consistency check | ₦437,700 | Tool: 99.9 units × 44,377 − 4,000,000 = ₦432,000 ⊂ documented Base monthly operating result ₦437,700 (`profit-scenarios.csv`) | Cross-check passed |

## What is deliberately NOT in these numbers

- The 45m–56m platform build estimate (sunk: the code exists and the company owns it).
- Other 5 of 7 revenue streams: advertising (CPC/CPM), Corks & Points loyalty, Clubs & Lounges (9% table-service), Stock My Bar/gifting, Phase 2 distribution — no recorded cost/revenue assumptions to model yet.
- Taxes (VAT, CIT), financing, depreciation, and historical development spend — same exclusions as `valuation-assumptions.md`.
