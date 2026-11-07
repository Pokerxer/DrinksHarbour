# Checkout payments — COD "coming soon", wallet & gift cards on Kora Pay

Date: 2026-10-28

## What changed and why

1. **Cash on Delivery is "Coming soon" on marketplace checkout** — disabled, not removed.
   - `client/apps/platform/src/app/checkout/page.tsx` — `PAYMENT_METHODS` entry
     `cash_on_delivery` now `badge: 'Coming soon', comingSoon: true`. The generic
     tile renderer already greys out and blocks selection on `comingSoon`, so no
     other change was needed. Default payment method remains `wallet`.
   - To re-enable: flip the entry back to `badge: null, comingSoon: false`.

2. **Wallet & gift-card payments for Nigeria run on Kora Pay** (Paystack is not connected).
   - This was already true server-side; the work here was removing stale "Paystack"
     copy that made the flows look Paystack-wired:
     - Wallet funding and gift-card *purchase* go through
       `server/services/storedValueFunding.js` → `payment.service.js`
       gateway-generic helpers (`createGatewayTransaction` / `verifyGatewayTransaction`),
       which pick the provider from `ACTIVE_GATEWAY` =
       `process.env.PAYMENT_GATEWAY` (`korapay` in `server/.env`).
       `storedValueFunding` records `row.provider` per funding row so older
       Paystack-created rows still verify with the right verifier.
     - Paying *at checkout* with a wallet/gift card is a direct balance debit
       (`server/services/checkoutDebit.js` via `POST /api/wallet/pay` and
       `POST /api/gift-cards/pay-checkout`) — no gateway involved.
   - Comment/copy updates (Paystack → Korapay) in:
     - `client/apps/platform/src/app/my-account/wallet/page.tsx`
     - `client/apps/platform/src/app/my-account/gift-cards/page.tsx`
     - `server/routes/wallet.routes.js`, `server/routes/giftcard.routes.js`
     - `server/controllers/wallet.controller.js`, `server/controllers/giftcard.controller.js`
   - Intentionally **not** touched: `payment.controller.js`/`erm.controller.js`
     Paystack routes (kept for when Paystack is connected) and ERM tenant
     subscriptions, which remain Paystack-only by design (`PAYSTACK_PLAN_*` codes).

## Verification

- `client/apps/platform`: `npm run type:check` clean.
- `cd server && node --test '__tests__/*.test.js'`: 4384 pass — payment/wallet/
  gift-card/korapay tests all green. The 23 failures are pre-existing,
  environment-dependent Mongo-transaction suites (venue/market), unrelated.

## Gotchas

- Korapay charge `channels` are `['card', 'bank_transfer']` (no USSD) in
  `payment.service.js` — the checkout tile ("Card / Bank Transfer / USSD")
  slightly overpromises USSD. Large carts hit channel per-transaction limits
  (AA021), which the service translates into a user-friendly message.
- Switching the storefront gateway back is the single env var
  `PAYMENT_GATEWAY` (`paystack`|`korapay`) in `server/.env`.
