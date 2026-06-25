# Implementation Prompt: Platform Gift Cards & Platform E-Wallet

> Stored value is **platform-issued and platform-wide**: DrinksHarbour issues and sells it,
> and it is redeemable at **any** tenant (online or walk-in). The **gift card is a standalone
> tender**, separate from the e-wallet. This is a bigger architecture than the existing
> *tenant-scoped* store-credit wallet — the two must not be conflated, and an inter-tenant
> settlement layer is required (when platform value is spent at a tenant, the platform owes
> that tenant).

## Context (read the existing code before designing anything)

DrinksHarbour is a **multi-tenant** drinks-commerce SaaS. Each tenant has an online storefront
(`slug.drinksharbour.com`) and physical walk-in stores with a POS. There are two client apps:
`client/apps/isomorphic` (tenant dashboard + admin + tenant shop) and
`client/apps/isomorphic-starter` (customer storefront, incl. `src/app/my-account` and
`src/app/shop`). Backend is Express + Mongoose in `server/`.

**A tenant-scoped store-credit wallet already exists — do NOT reuse it for this feature, and do
NOT rename or break it.** Specifically:

- `server/models/WalletTransaction.js` — append-only ledger, **`tenant` is required**,
  `ownerType` ∈ {`POSCustomer`,`User`}, authoritative balance on
  `POSCustomer.walletBalance` / `User.walletBalance`.
- `server/services/wallet.service.js` → `mutateWallet(...)` — atomic, guarded `$inc`
  (never goes negative), returns `{ ok, status, tx, message }`.
- `server/controllers/pos.controller.js` — POS already accepts `paymentMethod === 'wallet'`
  (tenant store credit) with an overdraw guard (~line 2393) and a **compensating refund if the
  order fails to persist** (~line 2459). Study this pattern; the new tenders must mirror its
  atomicity and rollback discipline exactly.
- `server/controllers/contact.controller.js` — existing `wallet/topup` and `wallet/adjust`
  endpoints (tenant store credit).

This feature adds **two NEW, platform-level (tenant-agnostic) stored-value instruments** that sit
*above* tenants. Name them distinctly in code and UI to avoid collision with the existing tenant
wallet — suggested: **Platform Wallet** (`platformWallet`) and **Gift Card** (`giftCard`).

## Goal

1. **Platform E-Wallet**: a customer holds one platform-wide balance, funded by purchasing credit
   on the ecommerce platform. Redeemable as a tender at **any** tenant's online checkout **and**
   any tenant's walk-in POS. Balance + history visible in `my-account`.
2. **Gift Card**: purchasable on the platform, carries its own balance, a unique code, and a
   scannable QR. It is a **standalone tender** (separate from the e-wallet) usable at any tenant —
   online (enter code) or walk-in (scan QR at POS). Optionally gifted to a recipient. A polished,
   branded card design renders in `my-account` and in the delivery email/PDF.
3. **Inter-tenant settlement**: every time platform stored value (wallet or gift card) is consumed
   at a tenant, record a **payable from platform → that tenant**, so the issuing platform
   reimburses the tenant where it was redeemed. Surface this for both tenant and platform admin.

## Identity (resolve this first)

Platform stored value is owned by a **platform-level customer identity**, not a `POSCustomer`
(which is tenant-scoped). Determine the correct owner: the storefront customer `User` account is
the likely anchor — confirm by reading `server/models/User.js` and how `my-account`
authenticates. At a walk-in POS, the cashier must be able to attach platform value to a
transaction by: (a) **scanning a gift card QR** (no account lookup needed for gift-card tender),
or (b) **looking up the customer's platform account** by phone/email/account ID/QR to apply the
e-wallet. Specify how a POS session links a walk-in to a platform `User`.

## Data model (new, platform-scoped — `tenant` is NOT required on these)

- `PlatformWalletTransaction` — append-only ledger: `userId` (owner), `type` ∈
  {`credit`,`debit`,`refund`,`adjustment`}, `amount` (positive int, NGN), `balanceAfter`,
  `redeemedAtTenant` (ObjectId|null — set on debits spent at a tenant, drives settlement),
  `source` (`purchase`/`pos`/`online_checkout`/`refund`), `reference`, `relatedOrder`,
  `paymentRef`, timestamps. Authoritative balance on `User.platformWalletBalance` (guarded ≥ 0).
  Mirror the `WalletTransaction` + `mutateWallet` design.
- `GiftCard` — `code` (unique, indexed), `qrToken` (signed; see QR section), `initialAmount`,
  `balance` (guarded ≥ 0), `currency` (NGN), `status` ∈
  {`pending_payment`,`active`,`redeemed`,`expired`,`disabled`}, `purchasedBy` (User),
  `assignedTo`/recipient (email/name/message), `design` (template id/theme), `expiresAt`,
  `paymentRef`, timestamps.
- `GiftCardTransaction` — append-only: `giftCardId`, `type` ∈
  {`issue`,`redeem`,`refund`,`adjustment`}, `amount`, `balanceAfter`, `redeemedAtTenant`,
  `relatedOrder`, `reference`, timestamps.
- `PlatformSettlement` (or settlement entries) — `tenant`, `instrument`
  (`platform_wallet`|`gift_card`), `sourceTxId`, `amount`, `relatedOrder`, `status`
  (`pending`/`settled`), `createdAt`. One entry per tenant-redemption; the amount is a
  platform→tenant payable.

All balance mutations: **atomic guarded `$inc` + append ledger row in one path**, never negative,
race-safe against double-redemption (concurrent POS scan + online use).

## Purchase flows (ecommerce platform / storefront)

- **Top up e-wallet**: choose amount → pay via the existing payment gateway → on **verified**
  payment (idempotent webhook/callback) credit `platformWalletBalance` + append
  `PlatformWalletTransaction(type:'credit', source:'purchase')`. Never credit on client-side
  success alone.
- **Buy gift card**: choose amount + design/theme + optional recipient (email, message, send
  date) → create `GiftCard(status:'pending_payment')` → pay → on verified payment flip to
  `active`, set `balance=initialAmount`, append `GiftCardTransaction(type:'issue')`, generate code
  + signed QR, deliver (email/PDF + show in buyer's `my-account`).

## Redemption flows

- **Online checkout (any tenant storefront)**: allow applying (a) e-wallet balance and/or (b) one
  or more gift-card codes as tender, with the remainder on the gateway. On order confirm:
  atomically debit each instrument, append ledger rows with `redeemedAtTenant = <storefront
  tenant>`, create `PlatformSettlement` payables, and roll back all debits if the order fails.
  Validate gift card status/expiry/balance server-side.
- **Walk-in POS** (`pos.controller.js` / POS sell UI): add two new tenders, `gift_card` and
  `platform_wallet`, alongside the existing tenant `wallet`.
  - `gift_card`: cashier **scans the QR** (or types code) → server resolves + validates (active,
    not expired, balance ≥ applied amount) → atomic debit + ledger + settlement payable for the
    current tenant → compensating refund if order persist fails (mirror the existing wallet-tender
    rollback).
  - `platform_wallet`: requires an identified platform `User` for the session; same atomic
    debit/guard/rollback, `redeemedAtTenant = current tenant`.
  - Support **split tender** (e.g., gift card partial + cash remainder), consistent with how POS
    handles multiple payments today.

## QR & card design

- QR encodes a **signed token** (HMAC/JWT over `{giftCardId, code, nonce}` with a server secret),
  **never** the raw balance. POS scan → `POST /giftcards/redeem/scan` verifies signature, returns
  card + live balance, then a separate guarded redeem call applies the amount. Signing prevents
  forgery; server is always the source of truth for balance.
- Card visual: a polished, branded component (logo, theme/design chosen at purchase, masked code,
  QR, balance, expiry). Render it in `my-account` (buyer + recipient views) and in the delivery
  email/PDF. Put real design effort here — it's a gifting product.

## Balance visibility (`my-account`, isomorphic-starter)

- E-wallet: current balance + paginated transaction history + a "Top up" CTA.
- Gift cards: list of owned/purchased cards with live balances, status, expiry, the rendered card
  + QR, and redemption history. Received gift cards (as recipient) appear too.

## Tenant + platform admin

- Tenant dashboard (`isomorphic`): report of platform instruments redeemed at this tenant (online
  + POS), and amount owed by platform (settlement payables, pending vs settled).
- Platform admin: issuance, outstanding liability (total unspent gift-card + wallet balances),
  redemptions by tenant, settlement reconciliation, and the ability to disable/refund a card.

## Non-functional / correctness requirements

- **Money** = positive integers in NGN (match existing convention; check whether kobo or whole
  naira is used and follow it).
- **Idempotency** on all payment callbacks/webhooks (dedupe by `paymentRef`).
- **Atomicity & overdraw guards** on every debit; **compensating/rollback** on downstream failure
  (follow `pos.controller.js` wallet-tender precedent).
- **Race safety** for concurrent redemption of the same instrument across channels.
- **Authorization**: a customer may only view/spend their own instruments; gift-card redemption
  authority is bearer-of-valid-QR/code at POS; tenant staff cannot read platform balances beyond
  what redemption requires.
- Expiry handling, refunds/voids (sale reversal must refund the exact instrument), and audit trail
  via the append-only ledgers.

## Suggested phasing (each phase TDD'd and independently green)

1. **Pure domain + models**: `GiftCard`/`GiftCardTransaction`/`PlatformWalletTransaction`/
   `PlatformSettlement` schemas; `platformWallet.service` (`mutatePlatformWallet`) and
   `giftCard.service` (issue/redeem/refund, signed-QR helpers) as pure, unit-tested functions
   mirroring `mutateWallet`.
2. **Purchase + funding**: storefront top-up and gift-card purchase endpoints + idempotent payment
   verification + issuance/delivery.
3. **Redemption — online checkout**: apply wallet + gift-card tenders at a tenant storefront, with
   settlement + rollback.
4. **Redemption — POS**: new `gift_card` + `platform_wallet` tenders, QR scan endpoint, split
   tender, rollback.
5. **Visibility + admin**: `my-account` balances/history + card UI; tenant settlement report;
   platform admin reconciliation.

## Acceptance / verification

- Server: `NODE_PATH=server/node_modules node --test server/__tests__/` — all green (add new
  suites; don't break existing).
- Client: `cd client/apps/isomorphic && ./node_modules/.bin/tsc --noEmit` — no new errors beyond
  the 27 TS2688 baseline (repeat for `isomorphic-starter`).
- End-to-end on an ephemeral mongod: buy wallet credit → spend at Tenant A online → spend
  remainder at Tenant B POS via QR → verify balances, append-only ledgers, two settlement payables
  (A and B), and a failed-order rollback leaves balance intact.
- Confirm the **existing tenant store-credit wallet** still works unchanged.

## Constraints

- Do not modify or rename the existing tenant `WalletTransaction` / `mutateWallet` / POS `'wallet'`
  tender semantics.
- Keep platform-scoped models free of a required `tenant` field; use `redeemedAtTenant` only to
  record where value was spent.
- Branch off `main` (currently has pricelist + loyalty merged).

## Open items to confirm before building

- **Identity is the riskiest unknown** — first confirm the platform customer model (`User` vs the
  unified contact concept) and how a walk-in POS attaches a platform `User`.
- Gift card redemption is **standalone** (per product decision). Note that **redeem-to-wallet**
  would have been simpler; the settlement layer is the main added cost of "platform-wide".
