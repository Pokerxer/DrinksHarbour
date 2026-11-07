---
name: Catalog information audio
description: Shared narration on product, category and subcategory detail pages, 2026-11-02.
type: project
---

Category and subcategory detail About sections use components/UI/DescriptionAudio
with category/subcategory information labels. Complete description then short
fallback; do not add a listen control when About is absent. The actual product
page uses Product/Detail/index.tsx and already has ProductDescriptionAudio, a
compatibility export of the same reader. ProductTabs.tsx is not that route's
active description implementation; do not add duplicate controls there.

All share the continuous fixed-voice Fish Audio service, click-only start,
Stop/navigation cleanup, loading/error UI and bounded prose conversion.
Keep full text, not SEO snippets or hero excerpts. Six actual category/page
integration checks plus 11 product-audio, 27 directory and 142 module checks
pass; TypeScript passes. Browser checks cover real category/subcategory/product
pages and 390px mobile fit. No new synthesis or backend change for this extension.
Handoff: docs/superpowers/specs/RESUME-catalog-information-audio.md.
Release server before/with client to avoid the old 300-character server cap.
No deployment/commit/push.
