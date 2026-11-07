# Failed managed delivery recovery

Local booking recover actions are explicit staff observations: reattempt,
return request, and physical receive_return at original location into quarantine.
`booking.delivery` remains original immutable trip; `activeDelivery` chooses a
new retry trip. Allocation, original stop/address, stock movement and charge stay
original. Driver claims and child/allocation writes serialize in one transaction.
Resolution/recovery keys remain bounded and saved; old exact replay is harmless.

Financial blocks prohibit reattempt of affected ranges, but never prohibit
receiving original physical goods. MerchantDeliveryReturn is immutable exact
allocation/range receipt evidence; it restores NO sellable stock/COGS/money.
No automatic restock/refund/payout policy exists. Customer views expose only
returning/returned coarse status and no private reasons, drivers or keys.

Implementation and current verification: docs/superpowers/plans/global-phases/
phase-d-failed-delivery-recovery.md. Root owns final broad acceptance and resume.
