---
name: Bottle search initialization fix
type: project
date: 2026-10-20
---

User reported no response. Live local public API returned bottles; browser caught
pre-hydration text being erased by controlled empty query state on initialization.
CatalogueBottleSearch now uses native uncontrolled input named search and reads
submitted form value. GET /shop fallback handles native pre-hydration/no-JS submit.
Abort/race guards remain. Real SSR/hydrateRoot test observed RED then GREEN.

206 platform tests, lint and types pass. Actual browser found six Glenfiddich
matches and added Glenfiddich 18 Years Old to planning list. No cart/order/message.
No production build over active dev .next, server restart or deployment.
Resume: docs/superpowers/specs/RESUME-bottle-search-fix.md.
