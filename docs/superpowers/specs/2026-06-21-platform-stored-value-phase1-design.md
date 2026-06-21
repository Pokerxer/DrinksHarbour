# Platform Stored Value — Phase 1: Domain + Models

**Date:** 2026-06-21
**Status:** Approved (design)
**Branch:** off `main` → `feat/platform-stored-value`

## Context

DrinksHarbour is a multi-tenant drinks-commerce SaaS. A **tenant-scoped** store-credit
wallet already exists and must NOT be reused, renamed, or broken:

- `server/models/WalletTransaction.js` — append-only ledger, `tenant` **required**,
  `ownerType` ∈ {POSCustomer, User}, authoritative balance on
  `POSCustomer.walletBalance` / `User.walletBalance`.
- `server/services/wallet.service.js` → `mutateWallet(...)` — atomic guarded `$inc`
  (never negative), append ledger row, rollback the inc if the ledger write throws.
  Returns `{ ok, balance, tx } | { ok: false, status, message }`.
- `server/services/contact.helpers.js` — the **pure, DB-less** money rules
  (`validateWalletTx` / `applyWalletDelta` / `summarizeWallet`) that `mutateWallet`
  pairs with the database. This split is the pattern Phase 1 mirrors.
- `server/controllers/pos.controller.js` (~2393–2485) — POS `'wallet'` tender:
  guarded debit → create order → compensating refund on persist failure → back-link tx.

This program adds **two NEW platform-level (tenant-agnostic) stored-value instruments**
that sit above tenants:

1. **Platform Wallet** (`platformWallet`) — one platform-wide balance per customer.
2. **Gift Card** (`giftCard`) — standalone balance + unique code + scannable QR.

Plus **inter-tenant settlement**: when platform value is consumed at a tenant, the
platform owes that tenant a reimbursement (a payable).

The full feature is decomposed into 5 phases (each independently green). **This spec
covers Phase 1 only.**

### Phase map (for orientation; only Phase 1 is in scope here)

1. **Phase 1 — Domain + models (this spec).** Pure helpers, Mongoose models, thin
   atomic services.
2. Phase 2 — Purchase + funding (storefront top-up + gift-card purchase, idempotent
   payment verification, issuance/delivery).
3. Phase 3 — Redemption: online checkout (apply wallet + gift-card tenders at a tenant
   storefront, settlement + rollback).
4. Phase 4 — Redemption: POS (`gift_card` + `platform_wallet` tenders, QR-scan endpoint,
   split tender, rollback).
5. Phase 5 — Visibility + admin (my-account balances/history + card UI; tenant
   settlement report; platform admin reconciliation).

## Established facts (verified against the codebase)

- **Money unit:** whole NGN integers. `WalletTransaction.amount` is `min: 1`; gateways
  multiply by 100 for kobo (`payment.service.js`). New instruments follow this exactly.
- **Payment gateway:** Paystack (primary, `reference`-based verify) + Stripe, in
  `server/services/payment.service.js`. Idempotency keys off the payment `reference`.
  (Relevant in Phase 2; noted here for the model fields `paymentRef`.)
- **Platform identity anchor:** `User` with `role: 'customer'`, `tenant: null` — the
  storefront account. It already carries a tenant-scoped `walletBalance`. The platform
  wallet adds a **distinct** `platformWalletBalance` on the same model.
- **Test suite:** entirely **pure / DB-less** `node:test`. No `mongodb-memory-server` is
  installed. The atomic `mutateWallet` layer is not unit-tested today; it is exercised
  through controllers.

## Decisions

- **Testing strategy (confirmed):** Phase 1 ships **pure helpers with full `node:test`
  coverage** (mirroring `contact.helpers.test.js`). The thin atomic services
  structurally mirror `mutateWallet` but are **verified later** via the ephemeral-mongod
  e2e introduced in a redemption phase. No new test dependencies; the suite stays green
  and fast.
- **QR token mechanism (confirmed):** **HMAC-SHA256**, not JWT. No new dependency, and
  the DB stays the single source of truth for balance/status (so no expiry is baked into
  the token).
- **`PlatformSettlement` (confirmed):** **schema only** in Phase 1. No writer until
  Phases 3–4.

## Out of scope for Phase 1 (explicit non-goals)

- No routes, controllers, or middleware.
- No purchase/funding or redemption wiring (online or POS).
- No client work (`isomorphic`, `isomorphic-starter`).
- No email/PDF delivery, no card visual component.
- No settlement writes (schema only).
- No change to the existing tenant `WalletTransaction` / `mutateWallet` / POS `'wallet'`
  tender semantics.

---

## 1. Models (`server/models/`)

All new platform-scoped models are **free of a required `tenant` field**.
`redeemedAtTenant` only records *where* value was spent.

### 1.1 `PlatformWalletTransaction.js` (new)

Append-only ledger; one row per balance change; never edited or deleted. The
authoritative balance lives on `User.platformWalletBalance`; `balanceAfter` snapshots
it immediately after this tx.

| field | type | notes |
|---|---|---|
| `userId` | ObjectId ref `User` | **required**, indexed (owner) |
| `type` | String enum `['credit','debit','refund','adjustment']` | required; `debit` lowers balance, all others raise it |
| `amount` | Number | required, `min: 1` (positive integer NGN) |
| `balanceAfter` | Number | required; owner balance after this tx |
| `redeemedAtTenant` | ObjectId ref `Tenant` | default `null`; set on debits spent at a tenant — drives settlement |
| `source` | String enum `['purchase','pos','online_checkout','refund','adjustment']` | required |
| `reason` | String | default `''`, trimmed, `maxlength: 280` |
| `reference` | String | trimmed, sparse |
| `relatedOrder` | ObjectId ref `Order` | optional |
| `paymentRef` | String | trimmed, sparse (gateway ref for `purchase`/`refund`) |
| `createdBy` | ObjectId ref `User` | optional (acting staff/admin) |

- `timestamps: { createdAt: true, updatedAt: false }`.
- Index: `{ userId: 1, createdAt: -1 }` (drives the my-account history page).

### 1.2 `User.js` (modify)

Add, alongside the existing `walletBalance`:

```js
// Authoritative platform-wide stored-value balance (NGN). Distinct from the
// tenant-scoped `walletBalance` above. Mutated only alongside an appended
// PlatformWalletTransaction; never goes negative.
platformWalletBalance: { type: Number, default: 0, min: 0 },
```

No other change to `User`.

### 1.3 `GiftCard.js` (new)

| field | type | notes |
|---|---|---|
| `code` | String | **unique**, indexed, uppercase canonical (e.g. `DHGC-XXXX-XXXX-XXXX`) |
| `qrToken` | String | signed HMAC token (see §2); unique + sparse |
| `initialAmount` | Number | `min: 1` (NGN) |
| `balance` | Number | `min: 0`, default 0 (set to `initialAmount` on issue) |
| `currency` | String | enum `['NGN']`, default `'NGN'` |
| `status` | String | enum `['pending_payment','active','redeemed','expired','disabled']`, default `'pending_payment'` |
| `purchasedBy` | ObjectId ref `User` | buyer |
| `recipient` | subdoc | `{ email, name, message, sendAt }` (all optional) |
| `design` | subdoc | `{ templateId: String, theme: String }` |
| `expiresAt` | Date | optional |
| `paymentRef` | String | trimmed, sparse (idempotency on issue) |

- `timestamps: true`.
- Indexes: `code` unique; `purchasedBy` + `recipient.email` for listings (Phase 5);
  `paymentRef` sparse.

### 1.4 `GiftCardTransaction.js` (new)

Append-only; mirrors `PlatformWalletTransaction` shape.

| field | type | notes |
|---|---|---|
| `giftCardId` | ObjectId ref `GiftCard` | **required**, indexed |
| `type` | String enum `['issue','redeem','refund','adjustment']` | required |
| `amount` | Number | `min: 1` |
| `balanceAfter` | Number | required; card balance after this tx |
| `redeemedAtTenant` | ObjectId ref `Tenant` | default `null` (set on `redeem`) |
| `relatedOrder` | ObjectId ref `Order` | optional |
| `reference` | String | trimmed, sparse |
| `createdBy` | ObjectId ref `User` | optional |

- `timestamps: { createdAt: true, updatedAt: false }`.
- Index: `{ giftCardId: 1, createdAt: -1 }`.

### 1.5 `PlatformSettlement.js` (new — **schema only** in Phase 1)

One entry per tenant-redemption; the amount is a platform→tenant payable.

| field | type | notes |
|---|---|---|
| `tenant` | ObjectId ref `Tenant` | **required**, indexed |
| `instrument` | String enum `['platform_wallet','gift_card']` | required |
| `sourceModel` | String enum `['PlatformWalletTransaction','GiftCardTransaction']` | required (refPath) |
| `sourceTxId` | ObjectId refPath `sourceModel` | required (the debit/redeem row) |
| `amount` | Number | `min: 1` |
| `relatedOrder` | ObjectId ref `Order` | optional |
| `status` | String enum `['pending','settled']` | default `'pending'` |
| `settledAt` | Date | optional |

- `timestamps: true`.
- Index: `{ tenant: 1, status: 1, createdAt: -1 }`.
- No writer exists until Phases 3–4; included now so later phases build against a stable
  contract.

---

## 2. Pure helpers (`server/services/`)

DB-less, side-effect-free, fully unit-tested — mirroring the wallet/loyalty sections of
`contact.helpers.js`. All money is positive-integer NGN; debits never overdraw.

### 2.1 `platformWallet.helpers.js`

- `PLATFORM_WALLET_TX_TYPES = ['credit','debit','refund','adjustment']`
- `PLATFORM_WALLET_SOURCES = ['purchase','pos','online_checkout','refund','adjustment']`
- `PLATFORM_WALLET_REASON_MAX = 280`
- `validatePlatformWalletTx(body)` → `{ ok, value: { type, amount, source, reason } } | { ok:false, message }`.
  Amount is a positive integer; `type` and `source` must be allowed; reason optional,
  trimmed, length-capped.
- `applyPlatformWalletDelta(currentBalance, type, amount)` → `{ ok, balanceAfter } | { ok:false, message }`.
  `debit` subtracts and is refused if it would go below 0; all other types add.
- `summarizePlatformWallet(transactions)` → `{ credited, debited, net, count, lastActivityAt }`
  (debits under `debited`, all else under `credited`).

### 2.2 `giftCard.helpers.js`

Domain rules:

- `GIFT_CARD_STATUSES = ['pending_payment','active','redeemed','expired','disabled']`
- `GIFT_CARD_TX_TYPES = ['issue','redeem','refund','adjustment']`
- `generateGiftCardCode(rng = require('crypto'))` → `DHGC-XXXX-XXXX-XXXX` over an
  ambiguity-free alphabet (no `0/O`, `1/I`). `rng` injectable so tests are deterministic.
- `normalizeGiftCardCode(code)` → uppercase, strip spaces/dashes (lookup key).
- `validateGiftCardPurchase(body)` → `{ ok, value } | { ok:false, message }`.
  Amount positive int; optional recipient email valid if present; `sendAt` parseable if
  present; design `templateId`/`theme` within allowed sets.
- `validateGiftCardRedeem(card, amount, now)` → `{ ok } | { ok:false, message }`.
  Card must be `active`, not expired (`now` injected), `balance >= amount`,
  `amount` positive int.
- `applyGiftCardDelta(balance, type, amount)` → `{ ok, balanceAfter } | { ok:false, message }`.
  `redeem` subtracts (guarded); `issue`/`refund`/`adjustment` add.
- `computeStatusAfterRedeem(balanceAfter)` → `'redeemed'` when `0`, else `'active'`.
- `isExpired(expiresAt, now)` → boolean (false when no `expiresAt`).
- `summarizeGiftCard(transactions)` → `{ redeemed, refunded, count, lastActivityAt }`.

Signed-QR helpers (HMAC-SHA256; secret injected by callers from `GIFTCARD_QR_SECRET`):

- `signGiftCardToken({ gid, code, nonce }, secret)` →
  `base64url(JSON.stringify(payload)) + '.' + base64url(HMAC_SHA256(secret, encodedPayload))`.
- `verifyGiftCardToken(token, secret)` → `{ ok: true, payload } | { ok: false, message }`.
  Recomputes the HMAC and compares in **constant time** (`crypto.timingSafeEqual`);
  rejects malformed tokens, tampered payloads, and wrong-secret signatures. No expiry is
  encoded — the DB is the source of truth for balance/status.

---

## 3. Thin atomic services (`server/services/`)

Structurally mirror `wallet.service.js`. **Not** unit-tested in Phase 1 (no
`mongodb-memory-server`); verified by the ephemeral-mongod e2e in a redemption phase.
Each pairs a pure helper with a guarded, atomic balance mutation and an append-only
ledger row, with rollback on ledger-write failure.

### 3.1 `platformWallet.service.js`

```
mutatePlatformWallet({
  owner: { userId },
  value: { type, amount, source, reason },   // as from validatePlatformWalletTx
  redeemedAtTenant,                            // for tenant-spent debits
  reference, relatedOrder, paymentRef, createdBy,
}) -> { ok: true, balance, tx } | { ok: false, status, message }
```

- Guarded atomic `$inc` on `User.platformWalletBalance`: for a `debit` the filter also
  requires `platformWalletBalance >= amount`, so concurrent debits can never drive it
  negative.
- Read the post-update balance straight back from the DB into the ledger row's
  `balanceAfter` (never trust a client figure).
- If the ledger `create` throws, undo the `$inc` to keep balance and ledger consistent,
  then rethrow.
- Failure shape mirrors `mutateWallet`: `status` 400 for insufficient (debit) / 404 for
  missing owner.

### 3.2 `giftCard.service.js`

- `issueGiftCard({ giftCardId, paymentRef, createdBy })` — flip `pending_payment` →
  `active`, set `balance = initialAmount`, generate `code` + `qrToken`, append
  `GiftCardTransaction(type:'issue')`. **Idempotent on `paymentRef`**: a second call with
  the same ref returns the already-issued card without double-crediting.
- `redeemGiftCard({ giftCardId | code, amount, redeemedAtTenant, relatedOrder, createdBy })`
  — resolve by id or normalized code; guarded atomic `$inc` on `GiftCard.balance`
  filtered on `balance >= amount` **and** `status: 'active'` **and** unexpired; append
  `GiftCardTransaction(type:'redeem')` with `redeemedAtTenant`; flip `status` to
  `'redeemed'` when balance reaches 0. Race-safe against concurrent POS-scan + online
  redemption of the same card. Returns `{ ok, balance, tx } | { ok:false, status, message }`.
- `refundGiftCard({ giftCardId, amount, relatedOrder, createdBy })` — guarded credit back
  (`type:'refund'`), reactivate from `redeemed` if balance becomes positive.

---

## 4. Tests (Phase 1 — pure `node:test`)

- **`server/__tests__/platformWallet.helpers.test.js`**
  - `validatePlatformWalletTx`: rejects bad type/source/non-positive/non-integer amount,
    over-long reason; accepts and normalizes valid input.
  - `applyPlatformWalletDelta`: credit/refund/adjustment add; debit subtracts; debit that
    would overdraw is refused; balance never negative.
  - `summarizePlatformWallet`: credited/debited/net/count/lastActivityAt roll-up.
- **`server/__tests__/giftCard.helpers.test.js`**
  - `generateGiftCardCode`: format + alphabet (deterministic via injected rng).
  - `normalizeGiftCardCode`: case/dash/space normalization.
  - `validateGiftCardPurchase`: amount, recipient email, sendAt, design validation.
  - `validateGiftCardRedeem`: rejects non-active / expired / insufficient / bad amount;
    accepts valid.
  - `applyGiftCardDelta` + `computeStatusAfterRedeem`: redeem guard, status transitions.
  - `isExpired`: with/without `expiresAt`, boundary at `now`.
  - QR: `signGiftCardToken`→`verifyGiftCardToken` roundtrip; tampered payload rejected;
    wrong-secret rejected; malformed token rejected.

## Acceptance (Phase 1)

- `NODE_PATH=server/node_modules node --test server/__tests__/` — all green, including the
  two new suites; existing suites unaffected.
- `client/apps/isomorphic` and `isomorphic-starter` `tsc --noEmit` unchanged (no client
  work this phase; baseline 27 TS2688 errors only).
- The existing tenant store-credit wallet still works unchanged (no edits to
  `WalletTransaction` / `wallet.service` / POS `'wallet'` tender).

## Constraints (carried from the program brief)

- Do not modify or rename the existing tenant `WalletTransaction` / `mutateWallet` / POS
  `'wallet'` tender semantics.
- Platform-scoped models carry no required `tenant`; `redeemedAtTenant` only records
  where value was spent.
- All balance mutations: atomic guarded `$inc` + append ledger row in one path; never
  negative; race-safe against double-redemption.
- Money = positive integers in NGN.
</content>
</invoke>
