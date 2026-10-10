---
name: Wyn City delivery pricing
description: REST tenant-origin road-distance fees with explicit zone fallback.
type: project
---

2026-10-08: storefrontShipping.service now uses Google road distance from tenant
location or complete saved street/city/state to customer pin; existing platform
distance tiers and thresholds apply. Pickup free. Zone rates explicitly estimated
when no pin/origin/provider. Never accept browser origin or fees. Quotes/payment
share cart.quoteCart. ors.service keeps default origin for platform callers,
adds optional tenant origin,8s timeout and invalid distance rejection.

Wyn City lacked saved GPS; its39 Gana Street,Maitama,Abuja address now works
directly. Read-only live quote returned15km/₦5,000. Summary shows distance/days
vs area estimate.70 units/types/build,15 browser checks,23 focused backend checks
passed. Full suite3,471 passed,5 skipped,0 failed. Handoff in docs/superpowers/specs/RESUME-wyn-city-delivery-pricing.md.
No orders/charges/GPS/data migration, commit or deployment.
