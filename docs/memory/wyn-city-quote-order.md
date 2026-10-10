---
name: Wyn City quote item identity
description: Multi-product quote502 fixed by matching REST-normalized product and size identities.
type: project
---

2026-10-09: REST normalizeCart sorts/merges lines. Standalone Wyn City quote route
previously compared by index, rejecting legitimate reordered multi-product quotes.
New quote-cart helper matches lowercase SubProduct+size and combined quantity,
rejects changed/missing/extra/duplicate response lines. NGN arithmetic and server
price authority retained. Live reversed cart502→200; pasted cart-state200 after
restoring stopped backend5001.74 units,18 checkout/delivery browser cases and
typecheck/build passed. Browser final
evidence and runtime details: docs/superpowers/specs/RESUME-wyn-city-quote-order.md.
No backend source changes, real orders/payments or persistent stock writes.
