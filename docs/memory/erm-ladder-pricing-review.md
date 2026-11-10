---
name: erm-ladder-pricing-review
description: pricing-skill review of the ERM tier ladder 2026-11-10 — findings, recommended moves, rollout guardrails; research only
type: project
---

2026-11-10: Ran the installed `pricing` skill against the live ERM ladder; output in `founder/pricing.md`. Research only — no code, `erm-plans.js`, Paystack plan codes or dataset changes.

Findings: Pro→Enterprise step compresses to 1.31× (other steps 1.76–2.33×); the documented blended ₦45,000 assumes the 20/40/30/10 Growth-heavy mix — a two-notch slip toward Starter pushes break-even from ~90 to ~104 tenants (from `founder/cfo.md`); SKU caps are a weak value metric for beverages (location add-ons fit better); no annual billing exists and it is the best lever on the year-1 cash need (₦23.3m); Bumpa entry ≈ ₦5k/month vs Starter ₦15K — do not cut Starter, the 14-day trial is the adoption vehicle; pricing page drift: Enterprise card sells "Dedicated manager" with no matching capability in `ERM_PLANS.features`/`EXTRA_CAPABILITIES`.

Recommended moves (pending user decision): raise Enterprise to ₦100–120K for new tenants only; add annual billing (2 months free) on Growth+ with new Paystack plan codes; promote locations over SKU caps as the Growth+ differentiator; decide the "popular" badge (page says Pro, economics assume Growth) from the first sales data; run Van Westendorp interviews with the 10 prospects in `docs/tenant-outreach/prospects/` — zero WTP research exists today; the single ₦85K Enterprise sale is the only above-Growth signal.

Any ladder change must move `ERM_PLANS`, `PLAN_TIERS` copy, and Paystack plan codes in the same change set; `planCapabilities.test.js` pins the comparison table; grandfather existing tenants as transition only.
