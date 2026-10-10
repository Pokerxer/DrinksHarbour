---
name: Tenant store banners
description: Dashboard banner ownership and custom website REST banner feed
type: project
---

Implemented locally on 2026-10-05. `/banner` redirects to `/banners` and is
covered by session middleware. Tenant owners/admins manage only their JWT-owned
banners; the server ignores forged tenant/global/creator/analytics fields.
Platform staff retain management. Detail, edit, delete, clone, status, bulk,
overview statistics and daily trends are scoped. Tenant controls hide global
publishing. Paused/draft scheduled saves do not automatically publish.

`GET /api/integrations/v1/banners` requires `storefront:read`. Optional placement,
device (desktop/mobile/tablet), limit 1–100 default 10. Exact key tenant only;
guest/all audience, enabled active/due scheduled records, valid schedule window.
Presentation allowlist omits notes, staff, internal analytics and media IDs.
Images use HTTPS; links allow root-relative paths/HTTPS; unsafe legacy CTA links
return null. Duplicate campaign titles generate unique slugs. Banner creation and
editing use authenticated dashboard routes; API keys read the storefront feed.

Guide: `/settings/api-keys/documentation#banners`, `docs/api/tenant-websites.md`.
Ownership helper: `server/services/bannerOwnership.js`; public REST serializer:
`server/services/storefrontBanners.service.js`. Editor split into small composition,
data, header and save-bar modules. No changes to the standalone Wyn City app.

Fresh verification: backend 3,402 pass / 2 opt-in skip; separate disposable MongoDB
banner lifecycle/API suite 7/7. Focused admin editor/documentation/middleware
13/13. Complete admin suite: 2,465/2,465 passed. Typecheck has 393 existing
project errors, none in the new banner components; details in the RESUME.
CodeRabbit CLI unavailable; manually reviewed authority, schedule and response
boundaries. No live tenant writes, deployment, commit or push.
