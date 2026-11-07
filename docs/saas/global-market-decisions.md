---
title: Global market implementation decisions and unresolved commercial facts
updated: 2026-10-24
status: engineering-decisions-not-production-approval
---

# Scope and authority

The user authorized implementing the subsequent strategy phases, agent collaboration and ordinary implementation decisions without questions. Earlier prohibitions on commits, deployment, production activation/data changes, real financial operations and customer messaging remain. This document records engineering decisions, not contracts or external certification.

| Topic | Engineering decision | Evidence still required before activation |
|---|---|---|
| One platform | Existing separate admin/platform apps and Express services remain; shared configuration, no per-country clones. | Hosted CI and release review. |
| Existing Nigeria behavior | Preserve legacy NG/NGN unless server opt-in MARKET_FOUNDATIONS_ENABLED=true. No flag is set by this work. Enabled mode requires saved active country, approved independent enrollment and channel config. | Reviewed cutover, restore and migration reports. |
| Wyn beverage exclusivity | Configurable stable Tenant ID, market/category/channel and dated policy; never identify a merchant by display name or guess an ID/date. | Actual contract, dates, exceptions and existing-merchant transition. No exclusivity seeded. |
| Accounts and fees | Versioned legal/provider account references, no secrets in public DTO; existing direct retail/zero-marketplace-commission and marketplace revenue splits retained. | Actual legal entities/account owners and agreed pricing/fee/refund terms. No new rates/provider selected. |
| ERM independence | Subscription entitlements remain existing authority. Marketplace rejection does not suspend permitted ERM, POS or independent storefront enrollment. | New country plan/pricing/trial terms require separate reviewed configuration. |
| Countries | Nigeria remains default. Future countries configurable inactive. Currency/locale/timezone are independent validated settings, not an FX or translation claim. | Legal/payment/delivery/support readiness evidence per activation/capability. |
| Separate website | Existing API/key/customer/account/location boundaries retained. No website rebuilt here. | Actual external repository, reviewed origins, key custody, hosted provider and browser journeys. |
| Accepted obligations | Configuration changes gate new commitments while saved order/payment terms and fulfillment remain intact. | Operator reconciliation and allocated returns/refunds before broader trading. |

No named commercial owner, signed agreement, provider approval, launch date or production readiness is inferred from user permission. Missing facts are represented as unavailable/pending configuration and explicit release gates, while local implementation/testing proceeds.
