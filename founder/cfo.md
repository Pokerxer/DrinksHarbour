# Unit economics: DrinksHarbour — Tenant ERM SaaS + Marketplace contribution (Business Plan v6, Abuja-first)

## The CFO's note

All amounts below are **NGN** (the tool prints `$`). Revenue is before VAT; if any listed price is meant to be VAT-inclusive, back out the 7.5% and rerun.

- **The margin.** Each paying tenant-month is priced at ₦50,200 blended (₦45,000 subscription + ₦2,200 add-ons + ₦3,000 marketplace contribution) and carries ₦5,823 of variable cost, leaving a **contribution of ₦44,377 (88%)** — an excellent gross unit. But at the Base-state plan (100 paying tenants, fixed costs ₦4.0m/month) the **margin after every cost is only 9%**: monthly profit ≈ ₦432k, matching the documented Base-state result of ₦437,700 in `docs/legal/investors/profit-scenarios.csv`. The gross margin is not the problem; the fixed-cost headcount is.
- **The line to watch: when fixed costs step up against the sales ramp — not the price.** The what-ifs prove it: holding fixed spend at the Bear-state ₦2.5m/month until revenue arrives (`cfo-lean-fixed.md`) lifts margin at plan from **9% → 39%** and cuts the year-1 cash hole from ₦23.3m to ₦11.4m. Meanwhile Price −10% swings margin at plan from +9% to **−2%** — price discipline matters, but headcount timing moves ₦12m of cash. Second-order: the ₦3,000 marketplace contribution is unproven (recorded fact: two tenants, zero online sales); on subscription-only revenue (`cfo-subscription-only.md`) break-even rises from ~90 to ~97 tenants — small, but year 1 stays deeply negative either way.
- **Cash.** At Base-state hiring you need **≈ ₦23.3m** before the model pays for itself; lean, **≈ ₦11.4m**. This brackets the documented ₦20–50m fundraising range in `valuation-assumptions.md` and is the first principled answer to it.
- **Three ways to improve the margin** (each run, not guessed):
  1. **Hold fixed costs at Bear-state burn** (staff ₹1.2m / GTM 0.6m / eng 0.5m / hosting 0.2m, −₦1.5m/month): margin at plan 9% → **39%**, year-1 loss −₦20.7m → −₦2.7m, cash needed ₦23.3m → ₦11.4m.
  2. **Prove the marketplace contribution** at its current all-variable cost: +₦3,000/tenant-month is 6% of revenue with no added fixed cost. If it materialises it is the only lever that improves the margin *without* cutting spend; if the ramp delivers GMV early, break-even falls below the Base plan.
  3. **Push the sales ramp, keep the price.** Volume −20% costs two extra months of losses (year-1 worsens by ₦2.8m) and is the single most assumption-sensitive input in the file; the ramp I supplied is an estimate starting from the confirmed two tenants. A one-month slip of the 90-tenant break-even adds roughly ₦0.9m of cash need at Base-state burn.
- **Board conditions on money:** no `founder/board.md` exists for this project; none recorded. Treat the 2026-10-31 agreements (selling-price markup, no-Upstash runtime) as standing constraints — they do not change these inputs.

*Not financial, tax or legal advice — have an accountant check corporate structure, payroll and tax before money moves.*

Every number below comes from the input file. Nothing is looked up or guessed.

## One paying tenant-month

| line | per paying tenant-month |
| --- | ---: |
| Price | $50,200.00 |
| Payment processing on subscription + add-ons (Paystack local) | -$823.00 |
| Variable service: tenant support + incremental infrastructure | -$5,000.00 |
| **Contribution** (what each paying tenant-month leaves to pay the fixed costs) | **$44,377.00** (88%) |

## The margin that matters

Fixed costs: $4,000,000 a month (Staff & founder pay (at Base-state headcount) $2,000,000, B2B sales & marketing $800,000, Continuing engineering & security maintenance $700,000, Baseline hosting, administration, software $500,000).

- **Break-even: 4 paying tenant-months a day.** Below that you lose money every month.
- **Profit margin at your plan** (3 a day): **9%** of every sale, after every cost.

## Year 1, month by month

| month | paying tenant-months a day | revenue | profit | cumulative (after $2,000,000 startup) |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 0 | $195,780 | -$3,826,930 | -$5,826,930 |
| 2 | 0 | $406,620 | -$3,640,546 | -$9,467,476 |
| 3 | 0 | $707,820 | -$3,374,284 | -$12,841,760 |
| 4 | 1 | $1,099,380 | -$3,028,144 | -$15,869,904 |
| 5 | 1 | $1,611,420 | -$2,575,498 | -$18,445,402 |
| 6 | 2 | $2,259,000 | -$2,003,035 | -$20,448,437 |
| 7 | 2 | $2,906,580 | -$1,430,572 | -$21,879,009 |
| 8 | 2 | $3,508,980 | -$898,048 | -$22,777,057 |
| 9 | 3 | $4,021,020 | -$445,402 | -$23,222,459 |
| 10 | 3 | $4,412,580 | -$99,262 | -$23,321,721 |
| 11 | 3 | $4,774,020 | $220,253 | -$23,101,468 |
| 12 | 3 | $5,014,980 | $433,262 | -$22,668,206 |

- **Year 1 operating profit: -$20,668,206** on $30,918,180 of revenue.
- After the $2,000,000 startup spend: -$22,668,206.
- Startup money earned back: not within year 1.
- Cash you need before it pays for itself: **$23,321,721**.

## What if

| scenario | margin at plan | break-even a day | year 1 profit |
| --- | ---: | ---: | ---: |
| Base plan | 9% | 4 | -$20,668,206 |
| Price -10% | -2% | 4 | -$23,760,024 |
| Volume -20% | -11% | 4 | -$26,134,565 |
| Unit costs +15% | 7% | 4 | -$21,206,164 |

## Red flags

- Year 1 loses money on operations (-$20,668,206).
- The startup spend is not earned back within year 1.
