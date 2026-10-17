# Final fulfillment attribution

2026-10-16/17: user requires the completing person's name to stay on a fulfilled
order, including POS completion, and become immutable. Quotation salesperson
still follows successful edits until conversion/completion. Final successful
delivery (not an earlier partial) assigns salesperson and salespersonUser and
stores fulfillmentAttribution {user,name,at}. Snapshot names survive profile
changes. Lists/export/detail prefer the snapshot; detail says Fulfilled by.

server/services/salesSalesperson.js: completeFulfillment accepts authenticated
actor objects; fulfillmentActorForReceipt resolves actual receipt.posStaff
tenant-scoped if a different user reconciles it. Model guards capture persisted
frozen state, reject save changes, and prevent update/query replacements touching
attribution on frozen orders. Source identity remains protected from body data.

Four paths wired: legacy manual, reserved manual, legacy POS reconciliation,
reserved POS receipt settlement. Reserved completion commits the snapshot in the
stock/receipt transaction. Replay returns original evidence without restamping;
payments/returns preserve it. No historical completion attribution was fabricated.

Resume: docs/superpowers/specs/RESUME-sales-fulfillment-attribution.md contains
verification evidence and local test DB cleanup status. No deployment requested.

Stale documents are guarded atomically: identity-changing saves also require
fulfillmentAttribution to remain absent in the persisted row via document.$where.
Do not remove this condition and rely only on post-init state: an edit loaded
before fulfillment could otherwise overwrite the completing user. Real replica
fixture verifies this race and preserves unrelated future operational saves.

Final verification: full backend3942 pass/16 optional skips,28 focused frontend
tests pass, real replica-set transaction/concurrency fixture pass, touched lint
and syntax/diff checks pass. Fixture DB dropped and temporary Mongo stopped.
