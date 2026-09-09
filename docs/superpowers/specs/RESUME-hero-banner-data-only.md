---
title: Database-only hero banners
status: complete
updated: 2026-09-09
---

# Database-only hero banners

`HeroBanner` no longer renders built-in demo slides. It shows a neutral loading frame while the placement request is pending, then renders only banners returned by `GET /api/banners/placement/:placement`. Empty or failed requests render no promotional content and notify `onEmpty` when provided.

The deprecated `useFallback` prop remains in the public type for caller compatibility but has no effect. Focused ESLint passes for `HeroBanner.tsx`.
