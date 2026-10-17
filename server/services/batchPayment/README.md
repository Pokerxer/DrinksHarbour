# Batch payment reconciliation

Batches group existing verified receipts/payments. They never post journals, move
cash, change wallet balances, or replay inventory. JWT tenant authority is required
at every HTTP boundary. All underlying reads and mutations are tenant-scoped.

- `members.js`: derive current eligible Accounting or Sales/POS portions.
- `mutations.js`: transactions for snapshots, ownership and reviewed transitions.
- `browse.js`: complete filtered totals, paginated history and current evidence.
- `../batchPayment.service.js`: compatibility facade.

Cash1000, Bank1100 and Wallet2200 reconcile independently. Source identity is the
posted journal plus account, scoped by tenant. Net is captured tender minus verified
refund credits in the same account. Missing, reversed, duplicate or inconsistent
proof is excluded. Cross-account refund attribution is never guessed. AR1300 is
not a tender. Saved Accounting payments additionally require matching AR1300/AP2000
counterpart proof; their existing `payment.batch` links remain authoritative.

Source claims require the unique partial active tenant/journal/account index.
`node scripts/setup-source-batch-claims.js` from server performs only this explicit
metadata setup. Models disable automatic creation/indexing for claims. Creation
refuses source selections until the required protection index is present.

New batches retain server-derived member snapshots. Completion rechecks current
proof, amounts and ownership; cancellation releases ownership but retains history
and leaves the original payments active. A completed batch keeps its claims.
External source changes can race snapshot reads; browsing continues to disclose
changed evidence even after completion. These metadata actions do not lock refunds.

Legacy batches retain their original account semantics. Existing linked payments
supply legacy history; missing cancelled history is unavailable, never fabricated
as zero. Transaction session operations must run sequentially. Nontransactional
read-only lookups may run in parallel.

Regression runner: `node server/scripts/test-source-batches.js` from repository root.
It hardcodes a disposable localhost test database, drops it afterward and never
loads business credentials. Standard server tests skip this opt-in integration.
