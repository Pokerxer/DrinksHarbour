# Separate website API

The merchant website is a separate project. Its server calls the existing DrinksHarbour API at `/api/integrations/v1`; this repository supplies catalogue, scoped customer accounts, cart quotes, checkout, orders and channel reports. No website app or custom-domain hosting is created here.

For the rest of the product, read [the full platform strategy](../../../docs/audits/specification-v3/strategy.md). This API guide covers only the separate website integration.

## Trust boundary

Keep the `dhk_...` API key on the website server. Never expose it in browser JavaScript, local storage or a public environment variable. The website backend forwards permitted customer actions and a tenant customer token. Client payloads cannot select Tenant, stock location, channel, fees or payment account.

A reviewed StorefrontChannel binds one Tenant, one website API key, one active Warehouse location, one channel code and one namespaced Paystack account reference. Product/SubProduct/Size stay authoritative. A merchant is a Tenant; Vendor still means supplier. Current direct checkout is NGN and Paystack.

## Setup and cutover

1. Inspect the separate website and agree the exact Tenant, active stock location, callback origins and merchant-owned Paystack account. None are guessed or activated by this implementation.
2. Issue a tenant API key with `storefront:read` and `checkout:write` using existing key management. API access requires an active approved subscribed tenant with `api_access` entitlement. Bind this key explicitly; other old keys for the mapped tenant are refused by the integration API.
3. Set a server secret named `STOREFRONT_PAYSTACK_<ACCOUNT>_SECRET_KEY`. `<ACCOUNT>` is an uppercase stable identifier, for example `WYN_CITY`; it is a reference, not a credential. The platform `PAYSTACK_SECRET_KEY` is never a fallback for a direct account. Retain the referenced account configuration while historical payments need verification/recovery.
4. Drain old online commitments and pause new ordering during cutover. Reconcile all WarehouseStock and SubProduct/Size rollups and batch stock before enabling. Do not seed another copy of stock. Existing marketplace payment-trust findings in the v3 audit remain a separate launch prerequisite; this work does not rewrite the marketplace payment UI or certify its legacy attachment/refund paths.
5. Create an operator mapping JSON with exactly `tenant`, `apiKey`, `warehouse`, `code`, `paymentAccount`, `returnOrigins`, `enabled`. IDs are the reviewed real IDs. `code` can be `WYN_WEBSITE`; `returnOrigins` contains exact HTTPS origins without a path/trailing slash. Start with `enabled:false`.
6. Set `STOREFRONT_CONFIG_MONGO_URI` explicitly; the script never loads `.env` or falls back to the application DB. Run `node scripts/configure-storefront-channel.js --mapping=/absolute/path/to/mapping.json --actor=<active-super-admin-id>` from `server` for preview. It checks tenant/key/location/account and legacy open orders without changing data.
7. After reviewing the preview, add `--apply --stock-cutover-reviewed` to write the channel and Tenant operator flag transactionally with an AuditLog entry. This is an operator action, not performed by development tests. Applying a mapping also establishes marketplace location stock authority, even when the website's enabled flag is false. Do not remove the record/flag to disable ordering: use `enabled:false` so existing holds retain their authority.
8. Existing channel Tenant/key/location/account/code cannot be casually reassigned by this script. A later change requires a reviewed migration. Origins and enabled status may be updated; old saved checkouts retain original account/channel/stock snapshots.
9. Register the merchant Paystack webhook at `/api/integrations/v1/webhooks/paystack/<ACCOUNT>` on the deployed API host. It needs the exact raw body and account signature, then verifies the reference against the same merchant account. The general platform Paystack callback is for the platform account.
10. Certify hosted test-mode payment/callback/cancel/fulfillment and rollback before live credentials. Test keys and local signature tests are not hosted provider certification.

Channel configuration requires reviewed stock cutover. The code does not backfill old orders or rollups, change existing seller permissions, register DNS, provision credentials or charge a merchant.

## Website server contract

All authenticated calls use `Authorization: Bearer <website API key>`. API responses are private/no-store. HTTP400 means invalid input,401 authentication,403 inactive scope/channel,404 unavailable/foreign record,409 conflict requiring refresh/review,429 rate limit,502/503 provider unavailable.

| Method and path | Responsibility |
|---|---|
| `GET /store` | Public branding/config plus resolved channel and stock location ID; no secrets. |
| `GET /products?page=1&limit=20` | Published tenant offers, own pending submissions and selected-location available stock. |
| `GET /products/:subProductId` | Product/variant descriptions, retail prices and location availability. |
| `POST /cart/quote` | Server prices, stock and shipping revalidation; no financial mutation. |
| `POST /checkout` | Idempotent persistent checkout; customer optional token; returns payment redirect only when ready. |
| `GET /checkout/:id` | Issuing-key-owned checkout/order/payment state. |
| `POST /checkout/:id/verify` | Verify saved reference against saved merchant account; do not accept browser payment claims. |
| `POST /checkout/:id/cancel` | Verify provider outcome before releasing an unpaid checkout hold; replay safe. |
| `GET /orders`, `GET /orders/:id` | Server-only issuing-key order administration with allowlisted fields. Do not proxy these wholesale to a shopper. |
| `GET /customers/orders`, `GET /customers/orders/:id` | Own order history; requires `x-customer-token` from the existing tenant customer login API. |
| `GET /reports/sales` | Server-only verified-paid channel/currency summary; not a net-refund ledger or tax report. |
| `POST /webhooks/paystack/:account` | Provider callback; signed raw bytes instead of API-key authentication. |

Customer registration/login/MFA/refresh/password recovery already live under `/customers`. Send the customer token in `x-customer-token` when creating an authenticated checkout so the API saves the customer relationship. Email matching does not grant order history. Guest checkout remains supported but cannot later claim order ownership merely by entering that email. API keys and customer tokens must not be logged.

Cart/checkout body:

```json
{
  "items": [{ "subProductId": "<catalogue-offer-id>", "sizeId": "<variant-id>", "quantity": 1 }],
  "shippingMethod": "pickup",
  "ageVerified": true,
  "customer": { "firstName": "Buyer", "lastName": "Name", "email": "buyer@example.com", "phone": "<phone>" },
  "returnUrl": "https://<reviewed-website-host>/payment/return"
}
```

Use a stable unique `Idempotency-Key` header for each customer checkout attempt. Reuse the same key and exact payload/customer identity after uncertain network responses. A changed cart/customer needs a new key. `initializing`/`uncertain` means poll/verify the saved checkout; never start another charge. Return URLs must match the configured origin exactly. Keep current shared `standard` delivery fields (`address`, `city`, `state`, optional `lga`, `country`, `postalCode`, coordinates); delivery currently supports Nigeria. A direct checkout always selects a Size because physical inventory is variant-scoped.

## Stock, money and fulfillment

- Direct website prices use the existing tenant retail price/discount, not marketplace commission pricing. Stored merchandise commission is zero; tenant share is full merchandise. Direct accounting posts merchant bank receipt, merchandise revenue and separately identifiable shipping income.
- Online holds reserve WarehouseStock without reducing on-hand. Owned batch allocations are captured transactionally. POS uses the same physical balances and reservation guard; mapped marketplace orders use the channel's configured location and keep marketplace revenue rules.
- Marketplace mapping preserves its existing payment contract. The separate website always starts pending and becomes paid only after saved-account verification. Do not describe the existing general marketplace payment paths as hardened by this change.
- Ship through the existing authorized order-status command. For new online location orders, stock consumption, batch evidence, movement history and order state commit together. Repeat shipment does not issue twice. Dispatch requires paid status; backwards transitions and cancel-after-shipping are refused.
- Unpaid cancellation releases only owned held quantities/batches. Paid cancellation or returned goods needs reviewed refund/return handling; this implementation does not invent a refund or return stock automatically. Late success on a cancelled checkout records `needs_review` without reacquiring goods.
- Existing orders keep their original stock mechanism. Never toggle off the Tenant operator flag to move active holds back to aggregate inventory. Existing multi-tenant order disclosure issues identified by the audit still need the separate child-order/projection workstream.

## Verification

Focused tests: `node --test '__tests__/storefront*.test.js' __tests__/apiKey.test.js __tests__/accounting.orders.test.js __tests__/routeGuardCoverage.test.js`.

Real integration uses only a disposable localhost replica set on29128, `storefrontDirect`. Set `DRINKSHARBOUR_DIRECT_TEST_MONGO_URI` to `mongodb://127.0.0.1:29128/drinks_direct_test_api?replicaSet=storefrontDirect` and an isolated test JWT secret. The test adds a PID suffix and drops only its own database. It never falls back to MONGODB_URI. See the resume file for actual results and operational limitations.

## Phase A safety continuation

The general marketplace payment/order safety work was subsequently implemented locally in [Phase A](../../../docs/superpowers/specs/RESUME-phase-a-transaction-safety.md). Its [fresh evidence](../../../docs/audits/specification-v3/phase-a-verification.md) supersedes the earlier “remaining marketplace findings” status in this API-task narrative. This does not activate the separate website or certify hosted payments. Preserve issuing-key/customer/account isolation, immutable channel mappings and existing stock authority.
