---
name: Specification v3 comparison and implementation map
description: Source audit of global country and channel expansion against existing ERM, with 39-page coverage and prioritized gaps.
type: project
---

2026-10-22: User requested review/compare/map for Downloads developer specification v3, not implementation. Durable report: `docs/audits/specification-v3/README.md`; resume: `docs/superpowers/specs/RESUME-specification-v3-review.md`.

Preserve Product/SubProduct/Size, Tenant, Warehouse/WarehouseStock and working ERM/venue modules. Document Prisma references are wrong. Separate platform/admin Next apps and Express API exist; global country configuration need not mean app consolidation. Merchant means Tenant; Vendor remains supplier. V3 Nigeria Wyn-only beverage marketplace, independent direct settlement and proposed UK provider model conflict with current business/provider rules and require explicit decisions before behavior changes.

Core gaps: country/category activation/exclusivity, independent enrollment, immutable sales channels/payment owners, shared location reservations, merchant child orders/shipments, custom domain lifecycle, gifts/food/capacity, international plans/legal and UK optimization/providers. Website gateway uses global Paystack credentials and tenant revenue math; general payment service defaults Korapay. Retail web aggregate reservations differ from POS/venue location stock. Existing venue Phase1 is request-only, not future capacity booking.

P0 source findings: public create uses supplied paymentStatus/status; legacy payment attach/refund lack general owner/role authority; mixed-tenant order detail returns full parent after participation check. No runtime fixes/exploitation or production actions performed. Review includes source links and24 proposed work packages, all39 pages, acceptance and migration boundaries.

Verification: standard sandbox suite3984pass/159fail/37skip with HTTP bind restriction; approved-network bounded suite4041pass/0assertion fail/8cancelled/36skip. Not clean full baseline. Focused network-enabled run141pass/0fail/cancel/skip. All39 page rows/24 work packages and seven Markdown files checked with no broken relative links/whitespace errors. No deployment/commit/push. External home-directory memory was not changed; this repository-local entry preserves the handoff within authorized writable roots. Resume directory is ignored, so include it deliberately in a future authorized handover.
