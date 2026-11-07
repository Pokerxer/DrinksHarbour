---
title: Phase A storage preparation and recovery
updated: 2026-10-23
status: local-implementation-production-not-authorized
---

# Preparation before a separately authorized deployment

This session does not authorize deployment, provider configuration, live refunds, account changes or production database writes. Complete the hosted test-mode and backup/restore gates independently.

1. Use Node22 and a Mongo replica set/transaction-capable deployment. Standalone Mongo is insufficient for new marketplace checkout, stored-value funding and checkout debit transactions. Verify installed dependencies from the reviewed manifest/lockfiles; the development installation was refreshed without editing manifests/locks.
2. Back up the database and validate restore in an isolated environment. Drain old in-flight marketplace payments and stored-value funding before a coordinated backend/frontend rollout. Existing orders, POS/venue identities, direct website channels and stock mappings are retained.
3. Prepare these new collections using the corresponding Mongoose model's `createCollection()` against an explicitly reviewed database: `marketplacepaymentclaims`, `marketplacerefunds`, `checkoutdebits`, `ordercheckoutrequests`, `storedvaluefundings`. Each relies on Mongo's mandatory unique `_id` index. Inspect `listIndexes()` and verify the `_id_` index before accepting traffic. Do not drop existing indexes, use `syncIndexes()`, backfill fabricated receipts or enable another tenant/channel.
4. `GiftCardTransaction.checkoutReceipt` defaults to false. Only new checkout-specific redemption rows receive true. No existing ledger rows are rewritten. Historical generic gift redemptions must not be blindly marked checkout receipts: some already funded wallet transfers or POS. Existing platform wallet checkout debits are eligible only for the matching user, positive receipt amount, correct source/type, no prior linked order, 24h proof and unique claim. Reconcile historical uses before cutover.
5. Hosted marketplace initialization now requires `Idempotency-Key` and saves platform provider/owner/amount/currency/purpose before transport. Wallet/gift checkout debit and unpaid order creation require the header too. Ship updated platform/admin callers together. Keep a checkout key across uncertain failures; do not change payment method or key to retry an unresolved debit/charge.
6. Existing hosted references without saved marketplace claims, and wallet/gift funding without saved funding records, require operator reconciliation. Never relax the receipt/purpose guard to accept them. Check the actual provider account and ledger; migrate only reviewed receipt identities in an independently authorized procedure. No bulk legacy financial migration was performed.

# Recovery and money boundaries

- `uncertain`/`initializing`: inspect the saved reference against the same provider/account. A timeout is not permission for another charge. Marketplace verification and owned post-payment order creation may recover a saved uncertain reference; initialization retries return the existing authorization response or a review conflict.
- `needs_review`: expired proof or success after cancellation/stock release. Saved receipt evidence remains durable; do not reacquire released stock or overwrite an allocated receipt. Decide an authorized refund or a newly reviewed sale outside this session.
- Signed callbacks validate account-specific signatures and use server verification. A verified callback arriving before the post-payment order is saved records the receipt as awaiting customer order creation. Recovery of the basket still needs the shopper's saved checkout data; there is no invented provider-to-cart reconstruction.
- Marketplace refund execution preserves the existing Stripe adapter only. It requires an allocated receipt, actor order-write permission, owned single-merchant scope or audited platform access, eligible paid state, positive bounded amount and a durable once-only refund identity. A second different partial refund requires reconciliation; general allocated multi-refund architecture is Phase D. Paystack/Korapay/wallet/gift monetary refunds fail explicitly pending a supported reviewed adapter. No gateway migration occurred.
- Monetary refunds never restock goods. Existing POS returns/refunds and venue billing keep their dedicated workflows. Marketplace refund accounting can remain `needs_review` until tenant settlement reversal allocation is reconciled; do not represent it as a completed payout ledger.
- Mixed-merchant tenant status/payment/cancel/dispatch actions refuse whole-parent mutations. A platform operator must review the whole order until Phase D child-order fulfillment exists. Owning customers may cancel eligible unpaid whole orders.
- Guest COD confirmation uses a signed, read-only order proof valid for24h on the checkout device. Order number plus email grants no access. Authenticated history uses the actual saved user relationship; unrelated guest email orders are not claimed automatically. Tenant website customer tokens and issuing API keys are separate.

# Rollback

Pause new checkout/funding and preserve receipt/request/refund collections, immutable ledgers, paid orders, stock reservations and direct channel mappings. Do not roll back to client-controlled settlement or delete claims to unblock a retry. Reconcile uncertain operations before restoring traffic. Prefer a forward safety fix or a maintenance response for affected commands; retain the private projections/authorization guards even if a frontend rollout must be reverted. Restore a backup only under a separately approved incident procedure that accounts for money received since the snapshot. Disabling the separate website uses its existing channel flag, never deletion of stock authority.
