# Stock movement documents

Stock movement details print through requestDocumentExport/buildMovementDocument and the tenant-aware shared preview. Keep missing movement costs unavailable; a finite recorded totalCost takes precedence over unitCost × quantity. A movement record does not provide the original invoice tax/payment/refund total and must not be labelled as a financial invoice.

Link purchase/order documents only through recorded relatedPurchaseOrder/relatedOrder IDs. Manual reference text (including transfer numbers) does not identify a route ID and must not be used to fabricate invoice URLs. Nonconfirmed movement balances display Not posted.

Handoff: docs/superpowers/specs/RESUME-stock-movement-document.md.

Panel follow-up 2026-10-04: Details and Document share movementDetails/buildMovementDocument. Posted change differs from recorded quantity for pending/reserved/released entries. Transfers/returns keep signed actual warehouse direction. Balances are historical; recorded date matches history and a differing performed date is explicit. Product and warehouse links use recorded IDs; show every persisted purchase/order link. Keep raw reference separate from linked PO/sales numbers. Document tab renders printable metadata/table/notes instead of its own calculation. Accessible tabs reset on movement ID change. Handoff: docs/superpowers/specs/RESUME-movement-detail-panel.md.

Verification for the panel follow-up: 2,412 admin tests, 19 backend history tests, focused movement TypeScript and whitespace checks pass. Project memory index also points to inventory_movement_panel.md.
