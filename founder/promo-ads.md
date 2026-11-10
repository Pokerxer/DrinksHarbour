# Ads & promotion — would they increase e-commerce revenue? (2026-11-10)

Companion to `founder/ecommerce-orders-cfo.md` / `ecommerce-sources.md`. Uses the `ads` skill discipline: end on facts, hypotheses, and MISSING inputs — no invented uplift numbers.

## The break-even hurdle (computed, not estimated)

From the per-order model (AOV ₦40,000, commission 11%, processing ₦700, refunds ₦400 — acquisition excluded):

- Contribution per incremental order, before promo cost: **₦3,300 = 8.25% of GMV**
- Therefore every promo naira must generate **₦12.1 of INCREMENTAL GMV** just to break even on contribution
  (1 ÷ 0.0825). The 2026-10-17 agreement also rules out passing promo costs into tenant payouts — discounts consume platform share, never tenant payout.

| Promo budget | Break-even requirement |
|---|---|
| ₦30k media test (the proposed start) | ≥ ₦363k incremental GMV ≈ **9 incremental settled orders** |
| ₦400k consumer draw | ≥ ₦4.84m incremental GMV ≈ 121 orders |
| Full ₦5m loan | ≥ ₦60.5m incremental GMV — **more than half of the entire modelled year-1 GMV (₦107.9m)** |

Same math on the stress variant: raising acquisition from 2% → 5% of GMV cuts per-order contribution ₦2,500 → ₦1,300 and needs a **5.8× order-volume uplift** just to hold year-1 contribution flat. Promotion is profitable only if it produces real incremental demand; heavy standing promo discounts are almost certainly value-destroying at 6.5% contribution rates.

## Two different acquisition cases (both in the funding proposal, one is much better)

| Case | Economics | Verdict |
|---|---|---|
| **B2B: recruit tenants** | Gate ≤ ₦150k CAC vs tenant contribution ₦44,377/mo → payback ≈ **3.4 months** | Strongly accretive — this is where the ₦600k business tranche should go first |
| **B2C: recruit shoppers** | Break-even ₦12.1× GMV per naira | Worth testing at ₦30k; scale only on settled-contribution gates, as already proposed |

Secondary effects ads can improve (hypotheses, not promises): per-order AOV (premium/gifting baskets clear subsidised delivery at ≥₦55k), repeat rate, GMV/tenant.

## Facts
- Unit economics: contribution ₦2,500/order base; ₦3,300 before acquisition; break-even promo hurdle ₦12.1 GMV/₦.
- Funding structure already exists: staged no-equity loan — ₦1m pilot (600k/400k), consumer starts at ₦30k, gates: 4 retained tenants ≤₦150k CAC + positive settled shopper contribution (`docs/memory/marketing-funding.md`).
- Infra: self-serve banners + click-through tracking exist (`popup_banner_clickthrough.md`); conversion events not yet verified end-to-end.

## Hypotheses to test (measure, don't assume)
H1 — Meta prospecting to Abuja can produce incremental settled orders at ≤₦3,300 blended cost per ₦40k order.
H2 — Occasion-anchored demand (wedding/party pre-order, already built: `wedding-chatbot.md`, `occasion-planning`) converts at materially higher AOV ≥₦55k, where delivery can be subsidised.
H3 — Tenant-side ads beat shopper-side ads on CAC per contribution naira (expected — payback 3.4 months vs GMV-share economics).

## MISSING (label, do not estimate)
Platform CPCs/CPMs for Nigeria drinks retail — **MISSING** (no ad accounts run yet).
Incremental vs organic attribution — **MISSING** (needs holdout or geo-split test per `ab-testing`/`attribution`).
Funnel conversion rate (visit → cart → settled order) — **MISSING** (recorded fact: zero online sales; no GA4 baseline in docs).
Lender acceptance/rates of the ₦5m facility — **MISSING** per `marketing-funding.md`.

## Verdict
Yes — promotion can increase e-commerce **revenue** mechanically (GMV is unconstrained by fixed costs), but its **profit** at the modelled 6.5–8.25% contribution rates survives only through the staged gate structure already drafted: tenant-recruitment first (3.4-month payback), ₦30k shopper test gated on settled contribution, standing discounts prohibited (they undercut payout-fixed economics). Not financial advice.
