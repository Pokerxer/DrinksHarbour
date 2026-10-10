
### Checkout unavailable recovery — 2026-10-08
The local running backend returned500 even for a nonexistent product before any
stock/order changes. Identical safe probe returned404 after backend refresh.
Read-only delivery quoting remains healthy. Source/model/service validation and
23 focused backend checks passed; no speculative behavior change. Original500
stack was not recovered. Real committed diagnostic rejected by approval review
and not run; safe writes were transactionally rolled back and gateway blocked.
No persistent test orders/charges/stock changes. Existing checkout attempt kept.
Handoff: drinksharbour/docs/superpowers/specs/RESUME-wyn-city-checkout-unavailable.md.
