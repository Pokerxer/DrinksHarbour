---
name: Complete platform strategy after separate website API work
description: Canonical strategy for all v3 pages and seven revenue streams with current status, dependencies and launch gates.
type: project
---

2026-10-22 user asked about the other work and requested the whole strategy in Markdown. Main file: `docs/audits/specification-v3/strategy.md`, linked from audit README, backlog and separate website API guide. Covers all seven revenue streams, nine sections of product/architecture/current status/delivery/workstreams/decisions/operations and references to39-page coverage/24 work packages.

Wyn website is already separate. API slice implemented locally and tested; live configuration, external hookup and provider certification remain. Do not rebuild its frontend here. V3-11/12 backlog wording corrected accordingly. Existing general marketplace payment-trust and mixed-tenant disclosure remain next priority, then country/enrollment, reviewed Nigeria integration, child orders/delivery/gifts/food/future capacity, international ERM, UK Smart Cart/providers and staged remaining revenue features.

This session changes documentation only. Strategy is not permission for production activation, seller suspension or commercial repricing. Keep proposed decisions/roles distinct from approved facts; do not invent dates, percentages complete or commercial ownership. Previous API verification4162 backend passes/37 skips and13 dedicated DB/HTTP passes is historical evidence, not a fresh runtime check in this documentation session.

User explicitly required currency settings, language, payment integration and delivery system. Strategy section5 now specifies settings ownership/inheritance; currency defaults/display versus transaction/settlement, minor units/FX/refund snapshots; locale resources/selector/persistence/fallback/formatting and translated communications; account-scoped provider capabilities and payment operations; delivery coverage/settings/quotes/provider adapters/dispatch/tracking/returns. Each has acceptance checks and v3 package/page mappings. These are planned requirements, not newly implemented runtime features.

User then requested a prompt to start implementation. Saved `docs/prompts/implement-phase-a-transaction-safety.md`, linked from strategy section9. It authorizes local Phase A V3-01/02/03 when used in an implementation chat: payment trust/receipt reuse, owner-authorized attach/refund/read, tenant-private projections/mutations, preservation of actual checkout/wallet/gift/POS/venue/direct API flows, fresh HTTP/Mongo/backend tests and durable handoff. This prompt-writing turn does not execute Phase A. Later currency/language/country/provider/courier expansion stays outside its scope.

2026-10-23 continuation: Phase A was implemented locally, superseding the “next priority”/prompt-only status above. Read `docs/memory/phase-a-transaction-safety.md` and its linked resume/evidence before continuing. Do not repeat the audit or start Phase B silently. No production activation; old stored-value/hosted references require reconciliation, unsupported monetary refunds fail explicitly and merchant child orders remain Phase D.

2026-10-23 Phase A close: final complete backend4248 pass/0 fail/0 cancelled/18 named skips (4266 total); dedicated Phase A17/17, direct website13/13, frontend tests/types/builds passed. Current receipt/index/recovery/legacy/runtime/opt-in limits are in the Phase A resume/evidence. Local completion does not approve release or Phase B.
