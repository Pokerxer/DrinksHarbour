---
name: Occasion thumbnails and direct chat
type: project
date: 2026-10-21
---

User wants images in product-name suggestions plus direct chat/upload bypass.
BottleChoice retains validated public image; BottleThumbnail uses OptimizedImage
with48px box and missing/error icon. Used in dropdown and selected catalogue rows.
OccasionChatEntry before source panels opens existing composer through imperative
open(), with no AI request or copied form values until explicit send. Same existing
Claude Haiku4.5/upload endpoint. Manual source-first flow still available.

Incomplete optional bottle drafts are preserved/excluded in direct mode so they
cannot block uploaded-list planning. Source Send still validates all selections.
No backend/package/credential change. Current verification and next-state handoff:
docs/superpowers/specs/RESUME-occasion-images-direct-chat.md.

Final checks:228 storefront tests, types and focused lint pass. Live images loaded
and mobile layout/direct open verified. Own tab closed; viewport reset. No deploy.

Next session: category-generated-list.md supersedes custom/manual size controls
and adds budget/guest-driven catalogue generation. Images/direct entry remain.
