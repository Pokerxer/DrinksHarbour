---
name: drinksharbour-tenant-review
description: Review DrinksHarbour changes for cross-tenant access, catalog ownership, marketplace pricing, and tenant payout regressions. Use when an issue touches those boundaries.
---

Open the DrinksHarbour workspace and read the tenant isolation and selling-price markup sections in root `AGENTS.md`. For selling-price markup also read `docs/memory/selling-price-markup.md`. Trace the affected request from its route and middleware through the data lookup, mutation, or checkout calculation.

- For authenticated tenant operations, verify that tenant identity comes from the JWT and each tenant-owned lookup includes its tenant scope. Check supported admin overrides separately. For public SubProduct reads, verify publication filters and exclusion of private fields.
- Trace catalog creation and visibility when relevant. A tenant owns its SubProduct, linked to the centralized Product. A new central Product created by a tenant must await approval for marketplace visibility. Check that orders derive tenant ownership from the persisted SubProduct.
- For selling-price markup, trace which tenant retail price and percentage apply. An explicit zero override must survive and a null override must inherit the tenant default. Check that discounts cannot reduce the tenant payout below retail and that existing order snapshots remain fixed.
- Report reproducible findings with a file and line, the affected actor, and the triggering input or state. Separate findings supported by code or tests from checks you could not run. Use the bundled Paperclip skill for the issue handoff when reviewing an assigned issue.
