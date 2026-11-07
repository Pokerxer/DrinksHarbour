---
title: Implementation blueprint for venue portions, menus and profit
updated: 2026-10-30
status: documented-not-implemented-by-this-plan
---

# Read this first

[Certain] The user asked to document implementation of the restaurant/club research. Existing Phase1/2/3 and current Phase4 services are foundations to extend. This document does not declare a new implementation, migration or activation complete.

The proposed architecture keeps one canonical product catalogue, tenant-owned commercial SubProducts/serving Sizes, tenant/location menu organisation, private recipes, authoritative physical stock effects and the existing accounting ledger. Restaurants, lounges and clubs share these layers; capabilities and selling modes select the appropriate workflows.

## Document map

| Need | Read |
|---|---|
| Why these patterns | [Menu/portion vendor research](17-menu-portion-reference-research.md), [profit vendor research](18-profit-costing-reference-research.md) |
| Engineering decisions and ownership | [Design](../../superpowers/specs/2026-10-30-venue-catalog-costing-design.md) |
| What exists and the actual gaps | [Source audit](../../superpowers/plans/venue-catalog-costing/source-audit.md) |
| Food/serving schemas, menu categories and extras | [Portions and menus](../../superpowers/plans/venue-catalog-costing/portions-menus.md) |
| Ingredients, batches, pours, cost snapshots and journals | [Production and costing](../../superpowers/plans/venue-catalog-costing/production-costing.md) |
| Margins, counts, net result and VIP packages | [Profit and package reporting](../../superpowers/plans/venue-catalog-costing/profit-reporting.md) |
| Routes, screens, roles, migration and rollback | [Interfaces and rollout](../../superpowers/plans/venue-catalog-costing/interfaces-rollout.md) |
| Tests and exact verification commands | [Acceptance](../../superpowers/plans/venue-catalog-costing/acceptance.md) |
| Task-by-task build order | [Execution plan](../../superpowers/plans/2026-10-30-venue-catalog-costing.md) |
| Where a new session resumes | [Scoped handoff](../../superpowers/specs/RESUME-venue-catalog-costing.md) |

## Proposed implementation order

1. Add safe serving IDs/index migration and menu hierarchy while preserving legacy retail/POS.
2. Connect exact portion recipes/modifiers to physical ingredient or prepared-output issue and retained cost evidence.
3. Add transactional batch production, measured yield and count evidence using the existing stock engine.
4. Reconcile canonical bill recognition and accounting so physical consumption and COGS each happen once.
5. Expose separately labelled margin/variance/contribution/ledger reports with completeness and source drill-down.
6. Extend the existing club package path with accepted component/revenue allocation and shared capacity/admission contracts.
7. Complete staff/public UX, adversarial/concurrent/browser verification, reviewed migrations and release preparation.

## Decisions to preserve

A menu category is not a product identity; a serving is not an ingredient unit; a deposit is not another sale; a complimentary mixer still has cost; a physical return is not the same event as a money refund. Unknown ingredient cost and projected recipe cost cannot be presented as verified profit.

[Certain] Source inspection found recipe stock claims can still be ledger-only and `Size.profitMargin` computes markup. Those are explicit implementation/compatibility tasks in this plan. They are not evidence that every historical venue operation or financial report is wrong. Actual account mappings, cost policy and business/tax decisions still require named review before live activation.
