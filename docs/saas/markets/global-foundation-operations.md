---
updated: 2026-10-27
status: local-preparation-only-production-activation-unapproved
---
# Global foundation preparation and rollback

**Turning `MARKET_FOUNDATIONS_ENABLED` off restores legacy admission; it does not close a market.** For a market stop, retain enforcement and pause the reviewed country/channel while keeping accepted-order recovery available. No commands in this document were executed against production. Configuration, index preparation, stock cutover and real money each require their own reviewed release decision.

This runbook describes current B/C/D source. Local evidence is in [Phase C](../../superpowers/plans/global-phases/phase-c-local-pilot.md), [Phase D implementation](../../superpowers/plans/global-phases/phase-d-implementation.md) and [pickup delivery](../../superpowers/plans/global-phases/phase-d-delivery.md). Root owns final combined verification. Local passing fixtures do not establish commercial approval, provider certification or restored backups.

## Authority and controls

| Control | Exact scope and rollback behavior |
|---|---|
| `MARKET_FOUNDATIONS_ENABLED === 'true'` | New marketplace country/category/enrollment/channel checks and new direct website snapshot/offer checks. Disabled callers retain legacy admission. Unsaved NG has legacy country version0 only while disabled; this is not an approved country configuration. |
| `MERCHANT_FULFILLMENT_ENABLED === 'true'` | Creates merchant children only inside a NEW paid, platform-settled, mapped-location online order's existing transaction. Requires all lines located; excludes COD/cash, direct integration, POS, venue/table booking and historical orders. Off prevents new child allocation; existing children/actions/pickup remain operable. |
| `MERCHANT_REFUNDS_ENABLED === 'true'` | Permits NEW execution of a reserved supported merchant refund. Request/budget reservation and reconciliation of an existing uncertain outcome are separate. Off blocks new execution; never erase reserved budgets, submitting/uncertain evidence or original receipts. |
| `StorefrontChannel.enabled` | Existing key-auth middleware uses it for all direct operations, including accepted checkout reads/recovery. Do not use this switch as an ordinary new-trading-only pause. |
| `SalesChannel.active` | New reviewed channel admission. An exact active→inactive PUT can pause even after country/key/location readiness is withdrawn, but cannot change identity/terms at the same time. Saved accepted checkout/order terms remain intact. |

Every setting is server-owned. Shopping `x-market-code` is a market preference, never tenant/account/fee authority. JWT tenant scopes staff; the issuing private API key selects the separate website tenant; the validated tenant-customer token selects customer ownership. Provider/account selection must match saved reviewed channel terms. No browser tenant/account or display-name match grants authority.

## Before any activation

1. Record accountable reviewer, change/release reference, target environment, rollback owner and exact versions. Obtain the stable real tenant ID, dated exclusivity/exceptions, legal/payment owners, agreed pricing/data rights and country/provider terms. Synthetic test IDs/references are not these facts.
2. Prove backup restore and inventory/payment/ledger reconciliation in a separate environment. Inventory the existing open legacy, mapped and merchant-managed obligations, initialization/debit receipts, uncertain provider outcomes and outstanding refunds. Record the original issuing key/account/location for each accepted flow.
3. Verify replica-set transactions, majority durability, exact indexes below, clock/date behavior and API authorization. `/ready`/DB connectivity alone does not establish country/channel/index readiness. Do not start the full server merely to audit indexes: its pre-existing warehouse reconciler calls `syncIndexes()` for Warehouse/Stock/Movement outside tests.
4. Complete hosted test-mode Paystack initialization→return→signed webhook→verify→receipt/stock/account evidence and actual callback/recovery origins, without inferring it from a stub. Retain configured original account secrets securely for accepted verification/reconciliation; never copy credentials into docs or browser code.
5. Keep all three new gates disabled until their narrower supported slice and operational recovery have explicit approval. Phase D currently supplies pickup only and a restricted original-Stripe merchandise refund compatibility path; this does not authorize Stripe adoption or provide Paystack/Korapay/wallet/gift-card merchant refunds.

## Index inspection and preparation

Use an explicitly selected, reviewed database connection with a separate DDL-capable preparation role. The application/agent must not discover a production URI from private dotenv files. The examples below are operator instructions, not executed migrations. First inspect and resolve duplicates; do not delete conflicting business records to force an index build.

Exact model collection names and declarations were obtained offline from the current schemas, without connecting a database:

| Collection | Required unique key (`1` means ascending) |
|---|---|
| `countryconfigurations` | `{ code: 1 }` |
| `marketenrollments` | `{ tenant: 1, market: 1, category: 1, channel: 1, version: 1 }` |
| `marketcategorypolicies` | `{ market: 1, category: 1, channel: 1, version: 1 }` |
| `saleschannels` | `{ tenant: 1, kind: 1, market: 1 }` **and** `{ code: 1 }` |
| `storefrontchannels` | `{ tenant: 1 }` **and** `{ apiKey: 1 }` |
| `integrationcheckouts` | `{ reference: 1 }` |
| `merchantshipments` | `{ merchantOrder: 1 }` |
| `merchantshipmentevents` | `{ shipment: 1, merchantVersion: 1 }` |

Use ordinary `{ unique: true }` options: no sparse/partial predicates and no TTL. Country/channel readiness rejects extra key fields, missing uniqueness, sparse/partial definitions or TTL. Enrollment/policy readiness requires the exact unique scope+version key, without sparse/partial predicates. Collection absence means unprepared, not permission to silently create it during a request.

`CountryConfiguration` and `SalesChannel` now explicitly set `autoIndex:false`; market revision schemas already did. Schema declarations do not prove the deployed indexes exist. Country/channel mutations return503 `COUNTRY_INDEXES_REQUIRED`/`CHANNEL_INDEXES_REQUIRED`; enrollment/policy writes return503 `MARKET_INDEXES_REQUIRED` until preparation. Never retry these as ordinary transient version conflicts.

Read-only `mongosh` inspection after an operator selects the reviewed database:

```javascript
const names = ['countryconfigurations', 'marketenrollments', 'marketcategorypolicies', 'saleschannels', 'storefrontchannels', 'integrationcheckouts', 'merchantshipments', 'merchantshipmentevents'];
for (const name of names) printjson({ collection: name, indexes: db.getCollection(name).getIndexes() });
// Example duplicate preview; repeat using every exact unique key above.
db.getCollection('marketenrollments').aggregate([
  { $group: { _id: { tenant: '$tenant', market: '$market', category: '$category', channel: '$channel', version: '$version' }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }, { $limit: 20 }
]);
```

Only after reviewed duplicate/size/restore/DDL planning, the additive index definitions are:

```javascript
db.countryconfigurations.createIndex({ code: 1 }, { unique: true });
db.marketenrollments.createIndex({ tenant: 1, market: 1, category: 1, channel: 1, version: 1 }, { unique: true });
db.marketcategorypolicies.createIndex({ market: 1, category: 1, channel: 1, version: 1 }, { unique: true });
db.saleschannels.createIndex({ tenant: 1, kind: 1, market: 1 }, { unique: true });
db.saleschannels.createIndex({ code: 1 }, { unique: true });
db.storefrontchannels.createIndex({ tenant: 1 }, { unique: true });
db.storefrontchannels.createIndex({ apiKey: 1 }, { unique: true });
db.integrationcheckouts.createIndex({ reference: 1 }, { unique: true });
db.merchantshipments.createIndex({ merchantOrder: 1 }, { unique: true });
db.merchantshipmentevents.createIndex({ shipment: 1, merchantVersion: 1 }, { unique: true });
```

Reinspect key/options afterward. An existing incompatible name/key/options or duplicate must halt activation; do not use `syncIndexes()`, drop/replace an index or hide build errors. `marketPolicy/management.ensureIndexes()` explicitly invokes both revision models' `createIndexes()` and AuditLog collection preparation; it is not called by request handlers and is not a production approval shortcut.

Intrinsic Mongo `_id` uniqueness is also load-bearing: CheckoutDebit, MarketplacePaymentClaim, OrderCheckoutRequest, IntegrationCheckout, OnlineStockReservation, MerchantOrder/Set/FulfillmentOperation, MerchantRefundAllocation/Evidence, MerchantGoodsCancellation and shipment/event identities. Keep those collections and identities durable. Never TTL/delete receipts, claims, operations, reservations, original-cost cancellation bases or refund evidence for cleanup. Quote expiry is validated by the service; no quote TTL is declared.

Supporting nonunique source indexes: integration checkout `{tenant:1,apiKey:1,createdAt:-1}` and `{state:1,createdAt:1}`; online reservation `{tenant:1,order:1}`; merchant order `{tenant:1,state:1,createdAt:-1}` and `{order:1}`; pickup quote `{tenant:1,merchantOrder:1}`; shipment `{tenant:1,createdAt:-1}`. Prepare them additively after reviewing workload. AuditLog has its existing seven-year TTL policy; do not shorten it or erase audit history during rollback.

## Configure and review B without trading

- Use `/api/countries/admin`, `/api/market-enrollments`, `/api/market-policies` and `/api/sales-channels` with real current JWT authority; the settings pages are review surfaces, not proof of approval. Mutations are super-admin operations except own tenant applications. Re-read before writing and retain `expectedVersion`;409 requires reload/review, never blind overwrite.
- Create country inactive with ISO alpha-2 code (GB, not UK), supported ISO currency/region locale, named IANA timezones and explicit marketplace/storefront/ERM capabilities. Configuration edits deactivate and clear reviews. Record each of `legal`, `payments`, `fulfillment`, `operations`, `merchantPolicy` with actual evidence; server stamps reviewer/time. Activate separately only after all reviews. The service validates reference shape, not the truth of external documents.
- Append distinct market/category/channel policy and enrollment revisions. Terms are `[effectiveFrom,effectiveUntil)`. Stable tenant IDs/exceptions enforce exclusivity. Latest version supersedes older approval immediately: a future-dated latest revision closes admission until its start; it does not schedule an automatic handover from the old approval. Review effective timing accordingly.
- ERM entitlement uses existing subscription/trial expiry independently of marketplace/storefront approval. Rejecting marketplace enrollment must not suspend the tenant or cancel ERM. A current/future unexpired approval cannot be replaced by a tenant reapplication; changes require platform review.
- Save inactive SalesChannel terms with explicit legal owner, provider/account owner, currency, pricing-policy/version/reference and exact immutable tenant/kind/market/code/key/location identities. Marketplace may list explicitly reviewed additional payment accounts; PUT replaces that list, and omission removes it. Do not infer a new fee from a terms reference or silently reassign identity. Country and channel activation do not replace category enrollment.
- Verify public DTOs exclude readiness/reviewer/audit/account secrets; tenant views exclude competitors; public catalogue/cart/new collection/checkout deny inactive/unapproved scope; exact accepted-order retry and verification remain available. New unsnapshotted receipts cannot be silently attached to a snapshotted order; reconcile rather than fabricate historical terms.

## Separate website and stock cutover C

Keep `/Users/mac/Documents/wyn-city-storefront` independent. Its server-only connection ends `/api/integrations/v1`; never import backend code or connect it directly to MongoDB. API key scopes are `storefront:read` and `checkout:write`; own customer auth uses `/customers` and `X-Customer-Token`. Browser email/return query claims are not authority.

The existing operator command previews a reviewed mapping by default, loads no dotenv, and requires explicit target/reviewer. Do not run it here against production:

```sh
node server/scripts/configure-storefront-channel.js --help
# With an explicitly approved STOREFRONT_CONFIG_MONGO_URI in a secure operator session:
node server/scripts/configure-storefront-channel.js --mapping=/reviewed/mapping.json --actor=REVIEWED_SUPER_ADMIN_ID
# Apply is a separate approved stock-authority cutover:
node server/scripts/configure-storefront-channel.js --mapping=/reviewed/mapping.json --actor=REVIEWED_SUPER_ADMIN_ID --apply --stock-cutover-reviewed
```

Mapping fields are `tenant`, `apiKey`, `warehouse`, `code`, `paymentAccount`, exact HTTPS `returnOrigins`, `enabled`. `STOREFRONT_PAYSTACK_<ACCOUNT>_SECRET_KEY` names the private original merchant account; never put its value in the mapping. Preview checks current tenant/key/location/account configuration, not hosted provider certification. Apply creates declared StorefrontChannel indexes, transactionally writes mapping+Tenant integration flag+audit. Identity changes are rejected; no supported in-place key/location/account/code reassignment exists. The first cutover rejects open legacy obligations; inventory/batch/warehouse reconciliation and approved drain remain required. Never rewrite old order channels, reservations or accounting to make the check pass.

Use the actual website correction: validate/refresh encrypted customer session in Route Handlers, persist rotated HttpOnly cookie, forward only the validated token and bind signed checkout cookie to customer+tenant+issuing key. Preserve SESSION_SECRET. Drain/reconcile accepted attempts before key replacement or revocation; do not disable StorefrontChannel/tenant/subscription/key to stop only new trading. Those broad controls also prevent key-authorized accepted recovery.

Legacy unbound checkout cookies and switched customer/key return403. Do not clear cookie/attempt storage and start another charge to bypass an unresolved payment. Recover with original approved account/connection or reconcile with store support. Automatic old-key credential selection/migration is not implemented. Hosted callback/recovery origins and customer-data rights require explicit approval.

## Operate supported D obligations

Child authority is frozen tenant+location+parent line identity and exact NGN minor-unit allocations under `merchandise-weighted-v1`. New paid supported parents receive explicit managed version1, or version2 when both merchant creation flags permit it; do not backfill history or route legacy/direct/POS/venue orders into it. Generic parent lifecycle/refund/rider-trip commands must reject both managed versions. `MERCHANT_QUANTITY_FULFILLMENT_ENABLED` additionally opts new orders into line-scoped original unit holds; it defaults off. Disabling new creation preserves accepted version1/2 recovery.

Staff `/api/merchant-orders` actions use current JWT tenant plus `orders:read`/`orders:write`, `expectedVersion` and stable idempotency key. Retry the same operation/payload after an uncertain response; a new key is not a recovery mechanism. Ship/cancel must consume/release only owned parent+tenant+location+variant holds and batch allocations once; money refunds never restock. Partial shipment must not move another merchant's goods or expose its financial split.

Pickup `/api/merchant-delivery` quotes require saved pickup method, zero child shipping and NGN; provider must be `pickup`. Quote freezes saved customer/destination/basket/tenant/location, zero amount, origin-only coverage and15-minute expiry. Book only accepted/picking child with same scoped quote/key; repeat returns one saved shipment. Tracking is deduplicated merchant-order state/version observation, not carrier/pickup/age proof. External parcel/food/courier providers remain unavailable. Separate `/api/merchant-local-dispatch` supports reviewed own-rider V2 responsibilities under default-off `MERCHANT_LOCAL_DISPATCH_ENABLED`; it is not a carrier certification. Read its package plan/README before configuration.

Refund execution is restricted to original allocated Stripe/platform or Paystack/platform NGN merchandise with exact customer/reference/amount/currency/channel binding and original posted tenant settlement journal/accounts (`4000`, `1300`, `6500`). Child and parent budgets reserve transactionally; provider/account/refund ID evidence cannot be reused. `reserved→submitting→succeeded` is the supported path; any uncertain provider/ledger result stays `uncertain` and must be reconciled against the known original refund ID, never resubmitted. Reconciliation can fetch prior evidence with the execution flag off. Keep original account credentials available. Shipping/tax reversals, unsupported providers and physical returns require another reviewed implementation; paid cancellation may remain blocked until the full required refundable allocation is safely resolved.

Paid never-shipped goods cancellation now reconciles the accepted Order cost snapshot with the original posted tenant `5000`/`1200` journal. It appends a goods-only debit1200/credit5000 reversal atomically with the owned stock release; original sales/COGS entries stay unchanged. Private MerchantGoodsCancellation freezes tenant cost residual ownership and once-only cancellation evidence. Missing positive-cost journals, mismatched snapshots/accounts or already consumed ranges require review409 before release. Legitimate legacy zero cost with no cost journal remains supported. Monetary refund alone still changes neither inventory nor COGS. V2 exact-unit refund/cost contracts and current local verification live in [the financial extension handoff](../../superpowers/plans/global-phases/phase-d-refund-provider-extensions.md); do not reinterpret an accepted V1 amount as V2 quantity evidence. Original Paystack/platform merchandise V1/V2 refunds are implemented behind the existing execution flag plus default-off MERCHANT_PAYSTACK_REFUNDS_ENABLED. Canonical positive transaction ID strings are retained from the actual receipt writer; only authenticated processed retrieval settles, and pending/unknown cannot create again. Kora/wallet/gift merchant refunds and shipping/tax/payout policy remain unsupported; consult the current finance completion ledger.

Managed original sales/COGS, successful refund and goods-cancellation journals belong to their exact saved Order/allocation/cost evidence. The generic journal reversal service refuses those records (and their reversal ancestry); unrelated manual accounting entries retain normal reversal. A previously reversed original sales journal blocks new refund reservation/execution for reconciliation before provider submission. Do not bypass this with another manual journal or new refund key, or discard a paid provider outcome to make the ledger appear clean. Preserve original references and domain evidence for a reviewed correction.

## Stop, rollback and reconcile

1. Record incident boundary, accepted IDs/keys/account references and exact deployed configuration versions. Pause NEW admission first with enforcement retained: exact SalesChannel active→inactive or reviewed country deactivation. Preserve issuing API-key/StorefrontChannel/tenant access, original provider accounts and accepted recovery endpoints. Country configuration edits also clear readiness; use explicit deactivation when no configuration change is intended.
2. Set merchant creation/execution gates off only through the approved environment release. Existing child actions, pickup observations and original-refund reconciliation must continue on snapshot-aware code. Flag off must not remove routes/services/models or replace them with an older binary that cannot interpret accepted snapshots/merchant versions.
3. If a compatibility rollback needs `MARKET_FOUNDATIONS_ENABLED` off, separately stop new traffic/collections at reviewed ingress before relaxing enforcement. Off is a return to legacy admission, not fail-closed lockdown. Retain receipt/order channel binding checks and never strip snapshots. Re-enable only after saved active reviewed configuration and final cross-boundary tests are proven again.
4. Classify unresolved outcomes: hosted claim initializing/uncertain; stored-value debit without allocated order; direct checkout pending/initializing/uncertain; late paid cancelled checkout `needs_review`; merchant refund submitting/uncertain. Keep original references and exact request/operation keys. Verify/reconcile their saved evidence; do not issue another debit/charge/refund or reacquire released stock merely to get a clean status.
5. Exact new marketplace accepted requests recover before live country/price/policy lookup when saved request fingerprint exists; direct checkout replay finds its tenant+issuing-key row before new quote/snapshot. Historical requests without that proof keep their legacy path: no invented fingerprint backfill. If ownership/terms differ, use reconciliation, not widened lookup.
6. Compare parent/child paid/refund minor totals, original tenant journals, warehouse on-hand/reserved/available, reservation states/batch quantities and movement counts. Repair only through reviewed domain commands with retained audit. Restore into an isolated target first; never restore an old DB over later provider money/inventory evidence without an explicit reconciliation plan.
7. Reopening requires independent review of current country readiness, latest policies/enrollments, channel/key/location/account identities, supported refund/delivery scope and restored-backup/provider evidence. No flag, source document or local test is that approval.

## Exit review and known limits

- B local foundations now cover reviewed management, missing-index denial, independent ERM, scoped discovery/cart/new payments/orders, immutable terms and accepted retry. The cross-review found implicit country/channel startup index creation; root reproduced2/2 schema failures and set both `autoIndex:false` (focused2/2 GREEN). This resolves that B source gap; it does not prepare any deployed indexes. Combined final suite/deployed readiness remain root/operator evidence.
- Review also found D startup index defaults. All eight new D models now explicitly disable autoIndex; root reproduced missing pickup schema policy (three RED assertions) and verified all five country/channel/pickup options GREEN. Deterministic `_id` remains current operation/booking/event authority. Secondary indexes still require reviewed additive preparation; these changes do not disable existing application autoCreate behavior or unrelated startup index jobs. No production index inspection/preparation occurred.
- Country audit revisions share one atomic document; writes eventually fail at Mongo's document size limit rather than discard history. An audited archival strategy is still a maintenance gate for heavy long-term configuration churn.
- Phase C's actual local pilot is7/7, strict direct13/13, external units75/75, types/build and focused Next browser8/8. Provider transport is synthetic; real hosted Paystack certification and real IDs/stock/cutover remain open. Legacy/key-cookie migration requires reconciliation as described above.
- D is locally restricted: paid mapped platform orders, immutable child allocations, pickup-only logistics and original-Stripe merchandise refunds. Do not treat this as general Paystack/NG marketplace merchant refund, tax/shipping reversal, parcel/food dispatch, carrier tracking or international readiness. Final routes/UI/combined acceptance must match the completed implementation handoff before any release.
# Quantity and rider recovery addendum (2026-10-27)

The private merchant queue now pages own open/closed/all groups with stable creation/ID ordering. Counts use the same JWT scope as rows; browser filters cannot select a tenant. V2 `/quantity/ship`, `/quantity/cancel`, `/quantity/allocations` and exact allocation delivery act on immutable original line intervals. Unit refunds use `/quantity-refunds`; server derives money from original ranges. A zero-only request is unsupported; zero-valued ranges may accompany a positive supported refund. Never invent a zero provider payment to clear those units.

New MerchantShipmentAllocation, MerchantQuantityCancellation, MerchantGoodsCancellation and MerchantDispatchContract/Quote/Booking/Budget collections require explicit reviewed schema/index preparation before any release. No index preparation ran in this implementation session. Per-leg dispatch does not alter the existing unique-child pickup MerchantShipment index. Audit exact declared keys/options and backups first; do not run blanket syncIndexes, reattribute old orders or reconstruct accepted unit ranges from current stock.

Rider allocations bind their exact saved dispatch booking. Confirm these through local-rider trip controls; the generic quantity delivery endpoint refuses managed legs. Recovery of an older allocation missing the new binding requires its existing exact saved booking+trip+stop links and never backfills evidence or repeats goods delivery. Driver legacyTrip/managedTrip claims survive uncertain stock results; generic trip cancel/edit, availability and deactivation cannot detach a claim. Retry/reconcile the exact original trip before releasing the rider, not a new dispatch key or manual driver status overwrite.

The original sales settlement and goods-cost journals must remain unreversed and exact. Managed originals, merchant refunds and goods cancellation journals refuse generic manual reversal using saved business references. A historical paired reversal blocks new merchant refund execution/reservation for explicit reconciliation; do not rewrite the original posting or invent a compensating entry through this UI.

## Recovery/carrier local continuation — 2026-10-28

Existing failed local bookings remain recoverable when creation is paused or current review is revoked. Explicit reattempt retains original goods allocation/charge and original trip while acquiring a new exact own rider responsibility. Old resolution replay cannot close a new trip; orphan claims require reconciliation. Return request does not prove receipt; physical receipt records quarantine at the original location, without sellable stock/COGS/refund/payout effects. See managed recovery README/ledger before any disposition.

Separate `/api/merchant-carrier` is default off (`MERCHANT_EXTERNAL_CARRIER_ENABLED`). Explicit platform review binds own saved location, account reference/courier service/capabilities and original accepted shipping budget. Fixed official Shipbubble protocol is a candidate implementation, not certification. A deterministic existing manual-shipped V2 allocation responsibility permits one booking POST; uncertain response retains its original budget/ID and never resubmits. Cancellation does not prove wallet/customer refund or release shipping money. Signed raw callbacks fetch current original-account status and deduplicate. External carrier delivery report is separate from canonical merchant goods confirmation. Preserve original account credentials for accepted reconciliation even if creation is paused. No funding/COD/duties/food/insurance or unsupported handling is inferred.

Current local acceptance/commands/failures/limits: `docs/superpowers/specs/phase-d-acceptance-2026-10-27.md`, focused continuation `RESUME-phase-d-recovery-acceptance.md`. The synthetic backup restore/replay exercise is not production restore or hosted provider certification. No local UI/test result authorizes production flags, real transactions, index/cutover changes or deployment. Shipping/tax/stored-value/Kora/payout and post-quarantine disposition remain separate implementation/policy gates.
