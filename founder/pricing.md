# DrinksHarbour ERM ladder pricing review (using the `pricing` skill)

As of 2026-11-10. Grounded sources: `server/config/erm-plans.js` and `client/apps/platform/src/app/vendors/register/data.ts` (the live offer), `docs/legal/investors/valuation-assumptions.md` (tenant mix, blended ₦45k), Bumpa competitor pricing recorded in `valuation-and-profitability.md` (≈ ₦5k / ₦20.8k / ₦62.5k per month), and `founder/cfo.md` (unit economics from the founder-cfo run). Traction: two paying tenants (one Enterprise, one Growth); no online sales; no willingness-to-pay research on file.

## The three axes

| Axis | Today | Assessment |
|---|---|---|
| Packaging | Free trial (14d) → Starter ₦15K → Growth ₦35K → Pro ₦65K → Enterprise ₦85K → Venue ₦150K; add-ons +₦12K/shop, +₦20K/warehouse (Pro+) | Structure is sound. One weak rung, one tier-count question |
| Value metric (what you charge for) | Capability ladder + SKU/staff/POS/warehouse caps + declining commission (13/13/11/10/9/9) | The declining commission is a genuinely value-aligned second meter — keep it. SKU caps are the weak metric for beverages (100 SKUs can be a wine closet or a distributor) |
| Price point | Blended ₦45,000 at the documented 20/40/30/10 mix | Unproven below Growth; the mix assumption is doing heavy lifting |

## Findings

1. **The step the ladder gets wrong: Pro → Enterprise (1.31×).** The other steps are 2.33×, 1.86×, 1.76×; a Best-tier at 1.31× the Better tier leaves money on the table (tier-structure guidance: Best is typically 2–3× Better). One distributor already pays ₦85K, so the ₦15K delta signals little.
2. **The mix is the margin.** Blended ₦45,000 assumes Growth-heavy. Slip the mix two notches toward Starter (35/35/20/10) → blended ₦39,000, contribution ₦38,377, and monthly break-even rises **90 → 104 tenants**; a 50/30/15/5 mix → ₦31,377, break-even ≈ **128 tenants**. Packaging, not price list, decides whether the CFO numbers hold.
3. **SKU limits are a noisy value metric for beverages.** They treat a 50-SKU club stockroom the same as a 50-SKU boutique shop. The location add-ons (+₦12K shop / +₦20K warehouse, first of each free per Business Plan v6) are the better-fitting meter — consider making locations the *primary* differentiator on Growth and up and demoting SKU caps to Starter-level guardrails.
4. **No annual toggle.** The standard 17–20% annual discount is also the single best lever against the CFO cash number (₦23.3m needed before it pays for itself): an annual Growth tenant pre-collects ~₦348K at signup instead of ₦35K/month. Cost: −16–20% of that tenant's contribution.
5. **Entry-point competitor gap is real but survivable.** Bumpa Starter ≈ ₦5K/month vs your ₦15K. Do NOT cut Starter (the low-price trap churns the complainers): the 14-day free trial, not a cheap tier, is the adoption vehicle. Track trial→paid by tier.
6. **Minor drift to fix in the page copy:** `PLAN_TIERS` Enterprise card sells "Dedicated manager", which has no corresponding capability in `ERM_PLANS.features` (and is not in `EXTRA_CAPABILITIES`). Either add the capability or cut the line — the guard tests otherwise protect 15 rows.
7. **Anchor decision: the page marks Pro "popular", but the economics assume Growth-heavy.** Pro ₦65K is a hard ask for an unproven Abuja market. Decide deliberately: either own Growth as the recommended tier (matches the ₦45K blended assumption) or keep Pro and accept a heavier-than-assumed Growth/Pro revenue mix risk.

## Recommended moves (all testable, none free)

| # | Move | Number it changes | Effect |
|---|---|---|---|
| 1 | Raise Enterprise to ₦100–120K for **new customers only** | Blended mix: ₦85K→₦110K adds ~₦2.5K/tenant at 10% mix (+₦25K/100 tenants/mo) | Fixes the 1.31× compression; grandfather existing Enterprise as transition |
| 2 | Add annual billing (2 months free, 16.7%) on Growth+ | Revenue/tenant −16.7%, cash collected at signup | Directly attacks the year-1 cash hole; needs new Paystack plan codes |
| 3 | Make locations (shops/warehouses) the Growth+ differentiator, SKU caps stay on Starter only | Move sensitivity from SKU mix to location adoption | Better-behaved value metric; aligns with the keep-locations-abstract rule |
| 4 | Change the "popular" badge Growth↔Pro deliberately | Mix-driven blended price (38.4K vs 45K) | Decide with the first 10 sales data points, not debate |
| 5 | Run Van Westendorp + rejected-price tracking with the 10 Nigerian prospects in `docs/tenant-outreach/prospects/` | Real WTP data to replace the ₦45K assumption | Currently zero pricing research exists; the ₦85K Enterprise sale is the only signal above ₦35K |

## Rollout guardrails (before anything changes)

- New customers first; stagger waves; grandfather (temporarily, not forever) — existing Paystack subscriptions are the plan of record.
- Changing `ERM_PLANS.priceMonthly` or adding annual plans requires new Paystack plan codes, entitlement-test updates (`planCapabilities.test.js` pins the comparison table), and the pricing page `PlanTier` copy to move in the same commit.
- Expect some churn on any increase — accept it; it usually removes the least-profitable accounts.

Not updated by this review (research-only): no code, pricing config, Paystack or dataset changes. Not financial advice.
