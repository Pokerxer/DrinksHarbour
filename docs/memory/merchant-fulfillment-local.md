# Merchant fulfillment local milestone

2026-10-26: Phase D partial local implementation. Entry points and boundaries: `server/services/merchantFulfillment/README.md`; full file map, evidence and unresolved acceptance: `docs/superpowers/plans/global-phases/phase-d-implementation.md`; pickup contract: sibling `phase-d-delivery.md`.

MERCHANT_FULFILLMENT_ENABLED and MERCHANT_REFUNDS_ENABLED default off. No production activation. New fully mapped paid electronic marketplace groups only, no historical child inference. Own transactional whole-group stock/hold/batch effects reuse existing authority; parent bypass guards stay active for accepted managed parents after creation flag disables. Refunds are own merchandise-only original allocated Stripe/platform source, exact original journal/account/reference/customer, global budget and once-only provider evidence. Uncertainty requires existing-provider-ID reconciliation; refund never restocks.

Focused backend12/12 and new admin5/5 passed; root owns full final checks and global resume. Not complete Phase D: quantity-split shipments, shipping/tax and other-provider refunds, returns/settlements, COD child collection and non-pickup carriers remain. Preserve dirty work, no commit/deploy without a new direct user instruction.
