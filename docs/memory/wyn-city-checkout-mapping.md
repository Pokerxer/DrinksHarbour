---
name: Wyn City checkout mapping
description: Standalone storefront delivery dropdowns, Google mapping and REST location persistence.
type: project
---

2026-10-08: Wyn City checkout at /Users/mac/Documents/wyn-city-storefront has
searchable keyboard State/LGA dropdowns, Google address suggestions, click/drag
Advanced Marker map, explicit GPS and reverse geocoding; manual fallback remains.
Fixed same-origin delivery lookup routes reuse public places/shipping endpoints.
Coordinates finite, paired and bounded; LGA/postcode optional. Backend stores pin
and optional shippingAddress.lga; regional shipping/tenant pricing still authoritative.
Manual edits cancel stale lookups/coordinates; quote waits for selected location.

Guide: sibling docs/checkout.md. Full handoff:
/Users/mac/Documents/drinksharbour/docs/superpowers/specs/RESUME-wyn-city-checkout-mapping.md.
70 units + types/build passed; backend3,463 passed/5 skipped/0 failed. Final20 checkout/auth/mapping browser tests passed; mobile/desktop inspected. No real order/charge/GPS/email, commit or deploy.
Google browser key uses existing provider domain/API restrictions. CLI CodeRabbit
unavailable; reviewed changed files locally. No code submitted to external review.
