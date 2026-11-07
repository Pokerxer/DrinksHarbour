---
name: Wedding bottle-list builder
type: project
date: 2026-10-20
---

User chose both catalogue and custom bottles for the wedding list. New typed
lib/weddingBottleList.ts and Weddings/{CatalogueBottleSearch,WeddingBottleList,
WeddingDrinkInterests} compose in WeddingPlanner. Catalogue is public approved
search only, explicit submit, six matches, stale/abort/error/empty handling.
Resolved public tenant narrows catalogue search; no admin route or pricing writes.

Edit custom names, size/pack details, quantity and bottle/can/case units; remove,
download or Clear brief. Maximum 20 entries and 9999 units per row. Cases remain
separate; no catalogue size/price/stock assumptions. Entries go into shared enquiry;
invalid rows block preparation and all edits invalidate drafts. Clear resets list,
search and interests but keeps Weddings. Download excludes personal brief fields.
No persistence, messages, cart mutations, dependencies or deployment.

205 platform tests, scoped lint, build and sequential type check pass.
Temporary preview server/tab closed and viewport reset.
Actual component/style preview fits 320/390/1280 widths; mobile inputs 16px.
Resume: docs/superpowers/specs/RESUME-wedding-bottle-list.md.

Search correction: controlled initial query could erase pre-hydration typing.
Native input/form value now fixes it. Actual browser search/add verified and
206 tests pass. See docs/memory/bottle-search-fix.md.

Wedding AI actions now open a reviewed list snapshot in the existing assistant;
explicit Add list to message and Send remain required. See wedding-chatbot.md.
