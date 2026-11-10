# Sources — per-order e-commerce model + stream 3 advertising (2026-11-10)

All amounts NGN, before VAT. Files: `founder/ecommerce-orders-cfo.md`, `ecommerce-orders-subsidised-cfo.md`, `ads-cfo.md` (+ their `numbers-*.json`).

| Input | Value | Source | Category |
|---|---:|---|---|
| AOV | ₦40,000/order (2–3 bottles) | Estimates from observed price lists: DrinksHarbour storefront hot deals (Gordon's ₦6,600 → Martell Blue Swift ₦92,100), Bottles&Glasses Lagos (Hennessy VS ₦55,900, Jameson ₦25,600), Sippy Lagos (Absolut ₦17,083, Jack Daniel's ₦22,000) | **Estimate** — public price evidence, no DrinksHarbour order data exists |
| Commission | 11% of GMV (blended) | `valuation-assumptions.md`; plan ladder 13→9% in `erm-plans.js` | Documented |
| Processing | ₦700/order (1.5% + ₦100 at ₦40k AOV) | [Paystack Nigeria pricing](https://paystack.com/pricing) | Publicly checkable |
| Refund/fraud reserve | 1% of GMV | `valuation-assumptions.md` | Documented assumption |
| Acquisition | 2% of GMV (₦800/order) | `valuation-assumptions.md` | Documented assumption |
| Delivery, base model | customer pays fully (pass-through) | The 2026-10-17 revenue agreement: delivery/taxes/processing are **outside** the gross merchandise split — `docs/memory/revenue-agreement-pricing.md` | Authoritative agreement |
| Delivery, subsidised stress case | ₦3,500 fixed per drop | Abuja bike-dispatch public rates: ~₦1,500–4,000 small / ₦4,000–7,000 medium (mypricespot.com.ng Abuja logistics, Nov 2025); Travo/VisCorner survey Abuja routes ₦2,500–9,500 (Sept 2025) | Publicly checkable |
| Break-even AOV under full delivery subsidy | ≈ ₦55,385 | Solve 0.065·AOV − ₦100 − ₦3,500 ≥ 0 (6.5% = 11% commission − 1.5% − 1% − 2%) | Tool arithmetic |
| Advertising attach | 2% of GMV at scale | **My estimate**, deliberately below marketplace-ad norms of 4–8% of GMV (no DrinksHarbour traffic or advertiser data exists) | Estimate — flagged |
| Ads infrastructure cost | ~₦200 per ₦100k GMV attach | Self-serve banner/listing infrastructure already exists — `docs/memory/popup_banner_clickthrough.md` | Code-grounded |

Key cross-check: the per-order base run yields 6.5% of AOV as contribution (₦2,500 on ₦40k) — higher than the 3%-of-GMV in `valuation-assumptions.md` only because delivery is customer-paid there; the subsidised stress case (−₦1,000/order) is what happens if the platform absorbs real drop costs, showing the old 3% subsidy is only coherent at AOV ≳ ₦55k.

Ramp: mirrors the `ecommerce-cfo.md` GMV ramp divided by ₦40k AOV (orders/day 0.008 → 33.33); tenants 4 → 200, GMV/tenant ₦2k → ₦200k — my estimate, unchanged from that file.
