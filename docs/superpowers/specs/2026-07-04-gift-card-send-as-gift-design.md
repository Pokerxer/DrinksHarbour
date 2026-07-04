# Gift Card — Send as Gift (Full Gifting Experience)

**Date:** 2026-07-04
**Branch:** feat/pos-fulfill-linked-so
**Status:** Approved

---

## Overview

End-to-end gifting flow for platform gift cards. A buyer can designate any active card as a gift to a named recipient; the recipient receives an email with a secure claim link; they sign in (or create an account) and the card transfers into their account. Both purchase-time gifting and post-purchase gifting of self-bought cards are supported.

---

## Data Model

### GiftCard — three new fields

| Field | Type | Notes |
|---|---|---|
| `claimToken` | String | Crypto UUID. Generated at issue time if `recipient` is set, or when buyer calls `send-gift`. Sparse + unique index. |
| `claimedBy` | ObjectId (ref User) | Null until recipient claims. |
| `claimedAt` | Date | Timestamp of claim. Null until claimed. |

Derived state (pending / claimed) is computed from these fields — no separate status enum is stored.

**No new model required.**

---

## Server

### New endpoints

#### `GET /api/gift-cards/claim/:token` — public, no auth
Returns card art metadata only: `{ amount, tier, senderName, message, currency }`. Never returns the code, balance, or QR.
- 404 if token does not exist.
- Returns `{ alreadyClaimed: true }` if `claimedBy` is set (frontend shows "already claimed" state).

#### `POST /api/gift-cards/claim/:token` — authenticated
Claims the card for the authenticated user.
- Rejects with 400 if: token invalid, already claimed, or `req.user._id === card.purchasedBy` (buyer cannot claim their own gift).
- On success: sets `claimedBy = req.user._id`, `claimedAt = now`. Returns `{ giftCardId }` so the frontend redirects to `/my-account/gift-cards/[id]`.

#### `POST /api/gift-cards/:id/send-gift` — authenticated, buyer only
Sets or updates `recipient` (name, email, message), generates a `claimToken` if none exists (existing token is reused on resend so old links remain valid), and sends the gift notification email with the claim link.
- Works on self-bought cards (first-time gift) and previously-gifted cards (resend).
- Rejects if card is not `active`, if `claimedBy` is already set (already claimed), or if the authenticated user is not `purchasedBy`.

### Modified existing endpoints

| Endpoint | Change |
|---|---|
| `GET /api/gift-cards` | Expand query: `purchasedBy === me OR claimedBy === me` |
| `GET /api/gift-cards/:id` | Same dual-access check (purchasedBy or claimedBy) |
| `POST /api/gift-cards/:id/redeem` | Allow only if `claimedBy === me` OR (`purchasedBy === me` AND `claimedBy === null`) |

### Issue flow change
`issueGiftCard` (in `giftCard.service.js`) generates and persists `claimToken` (via `crypto.randomUUID()`) when `card.recipient` is set. The existing verification email is updated to include the claim link: `[FRONTEND_URL]/gift/[claimToken]`.

---

## Frontend

### New page: `/gift/[token]`

Route: `app/gift/[token]/page.tsx` — outside the `/my-account` shell, uses the platform's main layout (header/footer). No auth wrapper; the page is publicly accessible.

**Always shown:**
- `PremiumGiftCard` component (read-only, no flip, no code shown)
- Sender name + personal message in a styled "from" panel
- Amount and tier badge
- "Usable at any tenant on DrinksHarbour" note

**Claim state matrix:**

| User state | UI |
|---|---|
| Not logged in | "Sign in to claim" → `/auth/login?redirect=/gift/[token]` |
| Logged in, unclaimed, not the buyer | "Claim this gift card" CTA → POST → redirect to `/my-account/gift-cards/[id]` |
| Logged in, is the buyer | "You sent this gift" — no claim button |
| Already claimed | "This gift has already been claimed" — no action |
| Token invalid / 404 | Error state with link back to home |

No dedicated hook — two direct fetch calls: GET on mount (public), POST on claim (with auth token from `AuthContext`).

---

### My-account gift cards list page

- **Fix the broken toggle:** Add `onClick={() => setForSomeone(!forSomeone)}` to the `<label>` in `GiftCardPurchaseModal`.
- **"Pending claim" pill (blue):** shown on `GiftCardTile` when `claimToken` is set and `claimedBy` is null — buyer is waiting for recipient.
- **"Gifted" banner (amber):** shown when `purchasedBy === me` and `claimedBy` is set. Card is locked — no copy button, no redeem access.
- **Recipient view:** tiles where `claimedBy === me` render as normal active cards (indistinguishable from self-bought).

### My-account gift card detail page — buyer view

**Gift Status panel** (shown when `claimToken` is set, inserted between card art and details):
- Pending: "Awaiting claim by [recipient email]" + **Resend email** button → `POST /api/gift-cards/:id/send-gift`
- Claimed: "Claimed on [date]" — read only

**Redeem-to-wallet** section is hidden once `claimToken` is set (card is destined for or belongs to recipient).

**"Send as gift" action** (shown on active, self-bought cards with `claimToken === null` and `claimedBy === null`):
- Button in the details panel opens a compact inline form: recipient name, email (required), personal message (optional)
- Submit → `POST /api/gift-cards/:id/send-gift` → success alert "Gift notification sent to [email]" → page refreshes showing the Gift Status panel

### My-account gift card detail page — recipient view

- Small "Gifted by [sender name]" note in the details panel (sender info stored in `card.recipient`)
- Redeem, QR, activity all work normally

---

## Email

The existing `emailService.sendGiftCardEmail` call in `verifyPurchaseGiftCard` is updated to include:
- `claimLink: [FRONTEND_URL]/gift/[claimToken]`

The `send-gift` endpoint uses the same email function for resends and post-purchase gifting.

The gift email shows the card amount, sender name, personal message, and a prominent "Claim your gift" button linking to the claim URL. The code itself is **not** included in the email (recipient must claim to their account to see it).

---

## Security

- `claimToken` is a `crypto.randomUUID()` — 122 bits of entropy, not guessable.
- The public GET endpoint never returns the code, QR token, or balance.
- Claim endpoint enforces: token exists, card is active, `claimedBy === null`, claimer ≠ buyer.
- Buyer loses redeem rights as soon as `claimToken` is set (card is now a gift in transit).
- All existing auth middleware applies to authenticated endpoints.

---

## Scope Boundaries

**In scope:**
- Purchase-time gifting (fix toggle, generate claim token on issue)
- Post-purchase gifting from the detail page
- Public gift landing page with account-gated claim
- Resend gift email
- Buyer/recipient views in my-account

**Out of scope (future):**
- Claim link expiry / TTL enforcement (can add a cron check later)
- Gift card transfers between accounts (claim is one-time, one-way)
- Physical gift card printing
