# My Account — Wallet / Gift Cards / Loyalty Refinement — Design Spec

> **Product:** DrinksHarbour Platform (drinksharbour.com)
> **Scope:** `/my-account/wallet`, `/my-account/gift-cards`, `/my-account/loyalty`
> **Date:** 2026-07-03
> **Type:** Refinement of an already-working stack (not a greenfield build)

---

## 0. Context & Baseline

All three features are already wired end-to-end and functionally sound:

- **Wallet** — NGN stored value on `User.platformWalletBalance`, funded via Paystack
  (`initialize → pay → verify → atomic credit`), append-only `PlatformWalletTransaction`
  ledger via `mutatePlatformWallet`. Pages/hooks: `wallet/page.tsx`, `useWallet.ts`.
- **Gift cards** — standalone stored value (`GiftCard` + `GiftCardTransaction`) with unique
  code + HMAC-signed `qrToken` generated on issue, usable at any tenant, redeemable into the
  wallet. Purchase via Paystack. Detail + redeem endpoints already exist and are **unused by any UI**.
- **Loyalty ("Corks & Points")** — points on `User.loyaltyPoints/loyaltyLifetimePoints/loyaltyTier`,
  tiers cork/barrel/cellar/vault @ lifetime 0/2 500/7 500/20 000, earn ×1/1.1/1.25/1.5,
  redeem ₦0.50/pt (min 100, step 50), referrals 500 pts. Pages/hooks: `loyalty/page.tsx`, `useLoyalty.ts`.

This spec **refines** the above. It does not re-architect the ledgers or payment flow.

### Confirmed decisions (from brainstorming)
1. Gift-card art is driven **automatically by amount tier**; the manual theme picker is **removed**.
2. Tier ladder is **premium-weighted** with a top **Black ≥ ₦5M** band and **Premium ₦1M–5M** band.
3. Gift-card QR uses the **server-signed `qrToken`**, rendered as a server-generated image.

---

## 1. Gift-card amount tiers

### 1.1 Tier ladder
A single source of truth: a pure helper `giftCardTierForAmount(amount)` returning
`{ id, name, minAmount, gradient, textClass, accentClass }`.

| Tier | Band (NGN) | `gradient` | Text |
|---|---|---|---|
| `classic`  | 1,000 – 49,999          | `from-stone-800 to-red-900`     | light |
| `silver`   | 50,000 – 199,999        | `from-slate-400 to-slate-600`   | light |
| `gold`     | 200,000 – 499,999       | `from-amber-500 to-yellow-600`  | dark  |
| `platinum` | 500,000 – 999,999       | `from-zinc-300 to-zinc-500`     | dark  |
| `premium`  | 1,000,000 – 4,999,999   | `from-indigo-700 to-purple-800` | light |
| `black`    | ≥ 5,000,000             | `from-neutral-900 to-black`     | light (gold accent) |

- **Client:** `client/apps/platform/src/app/my-account/gift-cards/_giftCardTiers.ts` (pure, exported
  `GIFT_CARD_TIERS` array + `giftCardTierForAmount`). Consumed by the preview, list tiles, purchase
  modal (live update), and detail page.
- **Server mirror:** add `giftCardTierForAmount` to `server/services/giftCard.helpers.js` and stamp
  the resolved `tier` id onto `design.tier` at issue time (so historical cards keep their tier even
  if bands change later). This requires adding `tier: { type: String, trim: true }` to the
  `GiftCard.design` sub-schema — Mongoose strips sub-doc paths not declared in the schema, so writing
  `design.tier` without the field would silently no-op. `tier` is derived/optional; no migration
  needed (old cards fall back to `giftCardTierForAmount(initialAmount)` on read).

### 1.2 Purchase limits
Amount bands now reach millions, so the server cap must rise:
- `giftcard.controller.js`: `MAX_AMOUNT` **200,000 → 20,000,000** (`MIN_AMOUNT` stays 1,000).
  Black is "₦5M+"; the ₦20M ceiling is a Paystack/fraud-sanity cap, documented in a comment.
- Route validator `body('amount').isInt({ min: 1 })` unchanged (controller enforces the real band).
- Purchase-modal presets updated to span the range:
  `[5_000, 25_000, 100_000, 500_000, 1_000_000, 5_000_000]` + custom.

### 1.3 UI behavior
- Purchase modal: remove `THEMES` + the theme picker. Show the **live tier name** ("Platinum gift
  card") and art as the amount changes. Custom-amount input accepts up to 20,000,000 with inline
  validation messaging that matches the server bands.
- List tiles + preview + detail: gradient/label come from `giftCardTierForAmount(initialAmount)`
  (falling back to a stored `design.tier` when present).

---

## 2. Gift-card detail page

New route: `client/apps/platform/src/app/my-account/gift-cards/[id]/page.tsx` (client component,
`Suspense`-wrapped like siblings). Consumes the **existing** `useGiftCardDetail(token, id)` hook and
`GET /api/gift-cards/:id` + `POST /api/gift-cards/:id/redeem`.

Layout:
- Large tier-styled card art (amount, code, tier badge, expiry).
- **QR panel** — image of the signed token (see §4). Caption: "Show this at any DrinksHarbour tenant."
- **Copy code** button (formatted `DHGC-XXXX-XXXX-XXXX`).
- Balance vs. initial, status pill, expiry, recipient (if a gift).
- **Redeem to wallet** action: amount slider/input 1 → remaining balance → `POST /:id/redeem`
  credits the platform wallet; success state shows new card + wallet balances. Hidden unless
  `status === 'active'` and `balance > 0`.
- **Transaction ledger** (issue / redeem / refund / adjustment) from `card.transactions`.
- Back link to the gift-cards list.

List page (`gift-cards/page.tsx`): each tile links to the detail route; add a small "Details" /
"Redeem" affordance (the redeem flow lives on the detail page — tiles just navigate).

---

## 3. Wallet page

Collapse the current **double list** (the "View all" bug that renders both *Recent Activity* and a
separate *All Transactions* panel) into **one** "Transactions" panel:
- Single paginated list (existing `WalletTransactionList` + `getWalletTransactions`).
- **Type filter**: all / credit / debit / refund (client-side over the fetched page is insufficient
  for paging, so add an optional `?type=` query param to `getWalletTransactions`; when absent,
  behavior is unchanged).
- Reuse the existing `DateRangeFilter` component; wire `?from=&to=` params on the endpoint
  (optional, ignored when absent).
- Richer rows: show redeemed-at-tenant name and related-order reference when present
  (`WalletTransactionList` already receives these fields).
- Keep the hero balance card and the 4 stat cards. Remove the `showAll` dual-render logic.

Server: extend `getWalletTransactions` to accept optional `type`, `from`, `to` filters (whitelisted,
defensively parsed). No change to the ledger or write path.

---

## 4. Gift-card QR (server-signed)

- **Expose** `qrToken` from `GET /api/gift-cards/:id` (currently omitted). Only the card **owner**
  can read it (endpoint is already ownership-scoped).
- **Render server-side**: add the `qrcode` npm package to `server/`. In `getGiftCard`, when the card
  is issued (`qrToken` present), generate a QR **data URL** encoding the signed token and return it as
  `qrDataUrl`. The raw token is also returned for completeness but the UI uses the image.
  - Encoded payload: the raw signed `qrToken` string (a tenant POS scanner decodes it, then validates
    server-side). Encoding a token — not a URL — avoids shipping a link to a page that doesn't exist yet.
- **Client**: detail page renders `<img src={qrDataUrl} />`; no client QR dependency.
- **Out of scope (documented as future work):** the tenant-facing POS scan-and-validate endpoint and
  any redeem-at-tenant flow. This spec only surfaces the QR to the card owner.

---

## 5. Loyalty page

- **Tier ladder**: each `TierCard` shows its lifetime-points threshold, an unlocked/locked state
  (compared to `loyalty.lifetimePoints`), and the current tier highlighted. The hero already shows
  "N / threshold" progress; the ladder adds "**N pts to {next tier}**" on the next locked tier.
- **"Ways to earn" explainer**: a compact static panel — earn rate (1 pt/₦ × tier multiplier),
  redemption rate (₦0.50/pt, min 100, step 50), referral bonus (500 pts). Pulled from the values the
  API already returns (`earnMultiplier`, `redeemRateNgnPerPoint`, `minRedeemPoints`, etc.). No new
  endpoint.
- Keep the hero tier card, stats, referral card, and activity list.
- No points-expiry engine (YAGNI — the `expiry` tx type exists but nothing schedules it; not in scope).

---

## 6. Cross-cutting: shared components + hardening

### 6.1 De-duplicate UI
- **One `StatCard`**: standardize on the existing `_components/StatCard.tsx`; delete the gift-card
  `StatCardInline` and the loyalty inline stat map, routing all three pages through `StatCard`.
- **One alert/verify banner**: extract the near-identical wallet + gift-card verify banners into
  `_components/InlineAlert.tsx` (`variant: 'info' | 'success' | 'error' | 'pending'`). Both pages use it.

### 6.2 Redemption idempotency (logic hardening)
Both `redeemLoyaltyPoints` and `redeemMyGiftCard` build references with `Date.now()`, so a rapid
double-submit can double-apply. Fix:
- **Client**: the redeem buttons already disable while `submitting`; keep that and also disable on
  success so the modal can't re-fire.
- **Server**: derive a **deterministic-per-intent** reference so an accidental duplicate within a
  short window collides instead of double-crediting. For gift-card redeem, key on
  `giftcard-<cardId>-<balanceBefore>`; for loyalty redeem, key on
  `loyalty-redeem-<userId>-<pointsBalanceBefore>`. Rely on the existing ledger's
  reference-uniqueness / guarded `$inc` to reject the duplicate. Where the ledger lacks a unique
  index on `reference`, add a short-window guard (look up an identical recent reference before
  mutating). Document the exact mechanism chosen during implementation after reading
  `platformWallet.service.js` / `giftCard.service.js`.

### 6.3 Tests
- `server/__tests__/giftCardTiers.helpers.test.js` — band boundaries for `giftCardTierForAmount`
  (client + server mirror agree on the same anchors).
- Extend gift-card controller tests for the raised `MAX_AMOUNT` and the `qrDataUrl` presence on a
  redeemed/issued card.
- Idempotency test: a duplicated redeem reference does not double-credit.
- Run the full existing server suite; keep it green.

---

## 7. File-level change summary

**New**
- `client/.../my-account/gift-cards/_giftCardTiers.ts`
- `client/.../my-account/gift-cards/[id]/page.tsx`
- `client/.../my-account/_components/InlineAlert.tsx`
- `server/__tests__/giftCardTiers.helpers.test.js`

**Modified — client**
- `gift-cards/page.tsx` — tier-based art, remove theme picker, updated presets/limits, tile→detail links
- `wallet/page.tsx` — single transactions panel + filters, remove `showAll` dual render
- `loyalty/page.tsx` — tier thresholds/lock state, "Ways to earn" panel, shared StatCard
- `_hooks/useWallet.ts` — pass `type/from/to` to `getWalletTransactions`
- `_components/StatCard.tsx` — ensure it covers all three pages' needs

**Modified — server**
- `controllers/giftcard.controller.js` — raise `MAX_AMOUNT`, stamp `design.tier`, return `qrDataUrl`
- `controllers/wallet.controller.js` — optional `type/from/to` filters on transactions
- `controllers/loyalty.controller.js` — deterministic redeem reference (idempotency)
- `services/giftCard.helpers.js` — add `giftCardTierForAmount`
- `services/giftCard.service.js` — stamp `design.tier` on issue; idempotency guard if needed
- `services/platformLoyalty.service.js` — idempotency guard if needed
- `models/GiftCard.js` — add `design.tier` field
- `package.json` — add `qrcode`

---

## 8. Non-goals
- No changes to Paystack init/verify or the atomic ledger write paths.
- No tenant-side POS scan/validate endpoint (future).
- No loyalty points-expiry scheduler.
- No changes to registration-time referral crediting.
