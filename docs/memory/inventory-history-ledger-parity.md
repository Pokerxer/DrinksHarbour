---
name: inventory-history-ledger-parity
description: WarehouseMovement vs InventoryMovement mirroring rules, the double-write bug fixed 2026-09-19, and the parity guardrails agents must preserve
type: fact
---

# Inventory ledger parity (WarehouseMovement ↔ InventoryMovement)

**One stock event ⇒ exactly one `InventoryMovement` row.**

- `WarehouseMovement` = authoritative per-warehouse audit (drawer History tab).
- `InventoryMovement` = unified product ledger (SubProduct Inventory→History tab).

## Landmine that caused drift (fixed 2026-09-19)

Two call patterns double-wrote / under-wrote the product ledger:

1. `poReceive.helpers.js` called `adjustStock` (which mirrors a `manual` row)
   **and** `recordReceiptMovement` (`purchase_order` row) → 2 rows per receipt.
   Fixed: `adjustStock({ recordHistory: false })`, keep the rich `purchase_order` row.
2. `stockTransferReceive.js` wrote only `WarehouseMovement` → transfers invisible
   in product history. Fixed: module transfers now mirror 2 rows (out/in,
   `referenceType:'transfer'`).

Vendor-return path (`purchaseOrder.controller.js`) had the same latent
double-write and got the same `recordHistory:false` opt-out.

## Guardrails

- If a flow calls `adjustStock` **and** a dedicated `record*Movement`, pass
  `recordHistory:false` to `adjustStock`.
- **Every** `WarehouseMovement` write site must have a matching `InventoryMovement`
  mirror. New stock ops = add the mirror.
- `adjustStock`'s mirror uses `referenceType:'manual'`; never rely on referenceType
  alone to detect "no mirror" when auditing (TRF-000001's old rows are `manual`).

## Re-check parity

Group `WarehouseMovement {transfer_in,transfer_out}` and
`InventoryMovement {transfer_in,transfer_out}` by
`tenant|subProduct|warehouse|reference|type`; counts must match. Migration:
`server/scripts/backfill-inventory-histories.js` (idempotent, `--apply` to write).

See `docs/superpowers/specs/RESUME-inventory-history-mirror-fix.md`.