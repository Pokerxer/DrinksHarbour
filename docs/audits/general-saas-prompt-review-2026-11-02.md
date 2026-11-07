---
title: General SaaS prompt refinement
date: 2026-11-02
status: prompt-complete-migration-not-started
---

# Review outcome

The original pasted prompt describes a reasonable strategic direction but mixes
future requirements, current capabilities and implementation authority. The
replacement is [the audit-first prompt](../prompts/general-saas-evolution-audit.md).
It preserves the general SaaS objective; it does not approve a new product model.

## Material corrections

| Original issue | Refinement |
|---|---|
| Mandatory specialist-agent organization | Single agent with skills, matching CLAUDE/AGENTS; delegation only if later requested |
| Tenant-owned UniversalProduct sample | Explicit comparison of ownership options with Product/SubProduct/Size compatibility and required rule amendments |
| Treats non-beverage support as absent | Requires inspection of existing product types and type-aware admin forms |
| Broad inventory/POS rewrite | Trace existing WarehouseStock/batches/reservations and retain one authoritative stock writer |
| Marketplace separation starts from scratch | Reuse storefront channels, account snapshots, merchant orders, market enrollment and fulfillment |
| Commission-only language | Preserve all three revenue models, selling-price markup agreement and existing channel contracts |
| Implied single frontend/general stack | Preserve Express/CommonJS/Mongoose, two Next apps, Expo mobile and existing shared packages |
| Twelve-week schedule called approved | Treat as an estimate hypothesis, reconcile with existing global phases and activation gates |
| Historical audit findings treated as current | Follow continuations and verify source; local implementation is distinct from production activation |
| Generic deployment/testing directions | Use current manifests, disposable test databases, existing runbooks and explicit staged approval boundaries |

## Source evidence inspected

- `CLAUDE.md`, `AGENTS.md`, root/server/client manifests and frontend/mobile scripts.
- Product, SubProduct and Size source excerpts; `server/constants/productTypes.js`
  and `server/utils/tenantContext.js`.
- `docs/audits/specification-v3/{README,architecture,strategy}.md` and relevant
  specification, independent storefront, Phase D and non-beverage RESUME files.
- `server/services/{storefront,merchantFulfillment,marketPolicy}/README.md`.
- Selling-price markup and standalone runtime memory; operations index and
  selective commit handoff dated 2026-11-02.

[Certain] These sources establish existing architecture and local implementation
records, not production readiness. [Likely] Incremental ownership/publication
separation is safer than replacing the product model; the future audit must choose
the actual design. No production data, secrets or external accounts were inspected.

This session refines a prompt, not the platform. No application code or existing
instructions changed. No application test suite was run or claimed passing.
Document path/link and whitespace checks are recorded in the session handoff.
