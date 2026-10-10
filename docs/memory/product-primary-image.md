---
name: Product primary image selection
description: Central product detail gallery and edit form preserve exactly one selected primary image.
type: project
---

Admin products/[slug] has Make primary controls for admin/super_admin, a primary badge, and inline saving/error/success feedback. Saves use the existing PUT /api/products/:id with only images; imported images without Cloudinary publicId work. Do not use the unregistered primary-image controller route.

product/primary-image.ts defines getPrimaryImageIndex and normalizePrimaryImages: honor an explicit selection, otherwise use the first usable image, preserve metadata, and clear other primary flags. The edit serializer uses the same primary-index rule; never OR the first image with an explicit primary flag. Keep the original index when hiding invalid gallery URLs.

Save failure retains the previous images. A synchronous request guard prevents overlapping saves. UI controls remain unavailable to tenant roles because these are central Products; SubProduct images/stock/prices are separate.

Verification and handoff: ../superpowers/specs/RESUME-product-primary-image.md. Admin full suite: 255 files / 2,475 tests passed with --maxWorkers=2; focused product suite: 20 passed. Type checking has 393 existing errors elsewhere, none in changed modules. Leave changes uncommitted unless asked.

Backend full suite: 3,402 passed, 2 skipped, 0 failed with local HTTP test-server permissions and two workers. Initial sandbox port errors and high-concurrency admin timeouts were resolved by the verified full reruns.
