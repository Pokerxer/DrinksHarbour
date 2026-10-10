# Build a tenant ecommerce website with REST

The in-app reference is at `/settings/api-keys/documentation`, linked from API key
settings. It includes connection examples, catalogue, checkout and customer endpoints, payment recovery
and deployment requirements.

The API supports a custom tenant website with a product catalogue, local cart,
guest orders, delivery quotes and hosted Paystack checkout. API keys are issued
at `/settings/api-keys`; choose **Tenant website** to grant `storefront:read`
and `checkout:write`. API access requires an active eligible tenant plan.

## Connect your website server

Configure these private environment variables on the website's backend:

```dotenv
DRINKSHARBOUR_API_URL=https://YOUR_API_HOST/api/integrations/v1
DRINKSHARBOUR_API_KEY=YOUR_SAVED_TENANT_KEY
```

Copy the actual base URL from the settings page. `YOUR_API_HOST` is the backend,
not necessarily your storefront domain. For local development use
`http://localhost:5001/api/integrations/v1`.

Call the API from Next.js route handlers/server actions, Express or your other
website backend. Never place the secret in browser JavaScript, HTML, a public
environment variable or a URL. Your backend authenticates its own customer
sessions, keeps checkout IDs associated with those sessions and limits requests
from visitors. Do not expose an unrestricted API proxy to visitors.

The Wyn City example uses tenant-only `/customers` endpoints behind explicit
website routes and encrypted HttpOnly sessions. The API key selects the store;
customer credentials and tokens are separate and bound to that tenant.
See [Customer accounts](tenant-customer-accounts.md) for signup, login,
verification, MFA, session rotation and password recovery.

Use `Authorization: Bearer <key>` on every request and `Content-Type:
application/json` on POST requests. The key selects the tenant; no tenant
header or body ID is required. A key does not authenticate an admin or customer
and cannot call JWT-protected platform/admin routes. Existing inventory and
Venue booking scopes remain separate.

```js
// Server-only helper. Paths must be chosen by your code, not an arbitrary
// visitor URL. Do not return raw error internals or the secret to the browser.
async function drinks(path, { method = 'GET', body, idempotencyKey } = {}) {
  const response = await fetch(process.env.DRINKSHARBOUR_API_URL + path, {
    method,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${process.env.DRINKSHARBOUR_API_KEY}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message);
  return result;
}
```

## Endpoints

All paths below are relative to the base URL.

| Method | Path | Scope | Result |
| --- | --- | --- | --- |
| GET | /store | storefront:read | Tenant name, slug, logo, colour, currency and shipping methods |
| GET | /banners | storefront:read | Published tenant banners, with placement and device filters |
| GET | /products | storefront:read | Tenant offers with pagination |
| GET | /products/:id | storefront:read | One offer and its active size variants |
| POST | /cart/quote | checkout:write | Current validated cart and delivery totals |
| POST | /checkout | checkout:write | Persistent order and Paystack checkout |
| GET | /checkout/:id | checkout:write | Minimal checkout, payment and fulfillment status |
| POST | /checkout/:id/verify | checkout:write | Server verification of Paystack payment |
| POST | /checkout/:id/cancel | checkout:write | Cancel a failed/abandoned checkout and release stock |

## Store banners

Manage your own store banners at `/banners` (`/banner` redirects there). Tenant
owners and tenant admins can upload images, configure links, placements,
display order, device visibility, schedules and publishing status. Tenant banners
cannot be made platform-global or assigned to another store. API keys provide
read access; create, edit, clone, pause and delete banners in the dashboard.

```js
const banners = (await drinks('/banners?placement=home_hero&device=desktop&limit=5')).data;
```

Optional filters: `placement` (a supported banner placement, e.g. `home_hero`),
`device` (`desktop`, `mobile`, `tablet`) and `limit` (1–100, default 10).
The API key selects the tenant. Results sort by display order, newest creation
and ID. Only enabled active banners and due scheduled banners within their
schedule appear. Drafts, paused, expired, future, logged-in/VIP audience and
other tenants' banners are excluded. The feed serves guest storefront visitors.

Each banner includes `id`, text, placement, ordering, display styling, desktop
`image` and optional `mobileImage` (`url`, `alt`, optional dimensions), device
visibility and CTA fields. Internal notes, staff, analytics and media management
IDs are omitted. Render text safely; prefer the mobile image on small screens.
Use `ctaLink` only when present. Links must be root-relative store paths or HTTPS
URLs. Set product paths to match your custom website.

## Catalogue and cart

```js
const store = (await drinks('/store')).data;
const catalogue = await drinks('/products?page=1&limit=20&q=wine&type=wine');
// catalogue.data = offers; catalogue.pagination = page, limit, total, totalPages
const product = (await drinks('/products/' + encodeURIComponent(offerId))).data;
```

List filters: `q` (literal name search, max 100 characters), `type` (central
Product type), `category` (central category ID), `page` (positive integer) and
`limit` (1–100, default 20). Results sort by product name then offer ID.

An offer's `id` is the tenant **SubProduct** ID, not its central `productId`.
Send the offer ID as `subProductId`. Its `variants[].id` is a **Size** ID and is
sent as `sizeId`. If `requiresVariant` is true, choosing a listed variant is
mandatory. Price is in NGN; variants expose the same `sellingPrice` used by
quotes, current `availableStock`, `maxOrderQuantity`, volume and pack size.
When `requiresVariant` is false, `baseSellingPrice` is the price for buying
without a size selection; `sellingPrice` is the lowest base/variant price.
Use `availability` to decide if the offer is purchasable and check stock on the
selected variant. Active sold-out variants retain their price for display but expose
zero stock and cannot be purchased. Legacy `in_stock` sizes are supported.
Offers with no valid selling price cannot be purchased.

Published active tenant offers reference approved public Products, or the
same tenant's own pending submissions (immediately sellable in that tenant's
store). Other tenants' pending Products, rejected Products and unpublished
SubProducts are excluded. Costs, suppliers, staff and accounting snapshots are
never returned. Product details include descriptions, images, beverage type,
ABV, volume, origin, flavour notes and `ageVerificationRequired`.

Your website owns its cart. Quote it before presenting the payable total:

```js
const cart = {
  items: [{ subProductId: offerId, sizeId: variantId, quantity: 2 }],
  shippingMethod: 'standard',
  shipping: {
    address: '10 Example Street', city: 'Abuja', state: 'FCT', country: 'Nigeria'
  },
  ageVerified: true // Only after the customer explicitly confirms their age.
};
const quote = (await drinks('/cart/quote', { method: 'POST', body: cart })).data;
// { currency, items, subtotal, shippingFee, total, shipping }
```

`shippingMethod` can be `standard` or `pickup`. Pickup has no delivery fee;
standard delivery requires a Nigerian state and uses the existing server zone
calculator. Checkout also requires a street address and city for delivery.
Quantities must be positive integers, max 1,000 per variant and 50 input lines.
Duplicate lines combine before stock and maximum-order checks. Variants must
belong to the offer and tenant. Alcoholic lines require `ageVerified: true`;
your website must present the project's age-confirmation gate before setting it.

Do not send prices, totals, shipping fees, tenant IDs, payment status or coupon
codes. Unsupported request fields are rejected. Existing scheduled retail
price discounts are applied automatically. Quotes do not reserve stock; prices
and stock are checked again during checkout.

## Create an order and take payment

Generate and save one `Idempotency-Key` per checkout attempt on your website
server (for example a UUID). Retain it across network retries; using a new key
means a new checkout. The key must contain 8–128 letters, numbers, dots, dashes
or underscores.

```js
const created = await drinks('/checkout', {
  method: 'POST',
  idempotencyKey: savedAttemptId,
  body: {
    ...cart,
    customer: {
      firstName: 'Ada', lastName: 'Example', email: 'ada@example.com',
      phone: '08012345678'
    },
    returnUrl: 'https://your-website.example/payment/return'
  }
});
const checkout = created.data;
// Save checkout.id with the visitor's session BEFORE redirecting.
// checkout: id, orderId, orderNumber, total, currency, reference,
//           status, authorizationUrl (null until ready), optional replayed.
if (checkout.authorizationUrl) {
  // Return only this hosted URL to the browser for navigation.
}
```

Customer first name, last name, email and phone are required, with bounded
strings and a valid email. `returnUrl` must be HTTPS; localhost HTTP is allowed
only outside production. The URL controls navigation, never payment status.

The server creates a pending Order, reserves both parent and variant stock in
a MongoDB transaction and initializes Paystack with its own unique reference,
NGN currency and computed amount in kobo. Request retries return the same
checkout. Reusing a key with different request content returns **409**.
Concurrent carts cannot reserve stock beyond its available quantity.

Creation returns **201** when ready, **200** for completed replays, or **202**
with a persistent recovery handle when pending/initializing/uncertain. A 202
is not a payment success. Do not redirect without `authorizationUrl`, and do
not replace an uncertain checkout with a fresh attempt. Verify it first; if the
provider confirms it was not initialized, cancel it and create a new attempt.

After Paystack returns to your site:

```js
const verified = (await drinks('/checkout/' + savedCheckoutId + '/verify', {
  method: 'POST'
})).data;
// Only status === 'paid' means successful automatic settlement.
const order = (await drinks('/checkout/' + savedCheckoutId)).data;
// orderStatus / paymentStatus expose fulfillment/payment without customer PII.
```

Do not trust callback query parameters, client-supplied reference/amount or a
browser claim of success. The server matches Paystack status, reference,
currency and amount to the persisted checkout. Signed Paystack webhooks also
settle it if the customer closes the browser before returning.

Checkout reads, verification and cancellation require the **issuing key** and
its tenant. Keep a visitor's saved checkout ID private to their authenticated
website session. When rotating keys, the new key cannot read old-key checkouts;
webhooks continue settling existing orders and tenant staff can see the Orders.

## Cancellation and reconciliation

`POST /checkout/:id/cancel` verifies the provider before releasing stock. A
paid or ongoing payment cannot be cancelled with this endpoint. Failed,
abandoned or confirmed not-found payments can be cancelled once; repeats do
not release stock twice. A new checkout should use a new idempotency key only
after the previous attempt is confirmed cancelled.

A background job checks unpaid checkouts older than 24 hours every 15 minutes
in production (or when `ENABLE_CRON=true`). It verifies payments before release;
provider outages and still-active payments retain their reservations. A payment
arriving after cancellation is recorded as `needs_review`, leaves the cancelled
order unfulfilled and flags staff to arrange a refund. It must not trigger a
success screen or duplicate fulfillment.

Refunds, customer accounts, loyalty, coupons and booking mutations are not
part of this REST surface. Tenant staff use the existing dashboard for order
fulfillment and refund handling. This guest checkout API is sufficient for a
product website, shopping cart, hosted payment and order status flow.

## Errors and limits

Failures have `{ success: false, code, message }`. Respect HTTP status:

| Status | Meaning |
| --- | --- |
| 400 | Invalid request or unsupported field |
| 401 | Missing, invalid, expired or revoked API key |
| 403 | Missing scope or inactive tenant API access |
| 404 | Offer/variant/checkout not found in the permitted scope |
| 409 | Stock, checkout state, idempotency or payment mismatch conflict |
| 429 | 60 requests per UTC minute per key exceeded; use Retry-After |
| 502/503 | Payment/database service unavailable; preserve the attempt ID |

Responses are private/no-store. Authentication rechecks key revocation, tenant
approval, subscription state and plan on each call. Do not cache these checks.
Server-to-server requests already work for custom domains; there is no need to
add every tenant website to global browser CORS.

## Backend deployment requirements

MongoDB must support transactions (Atlas or a replica set), and
`PAYSTACK_SECRET_KEY` must be configured. Register
`https://YOUR_API_HOST/api/payments/webhooks/paystack` with Paystack. The global
JSON parser captures original bytes at that path for signature verification;
webhooks are acknowledged only after processing completes. Secondary indexes
on `IntegrationCheckout` should be built through normal model initialization.
Idempotency itself uses a deterministic primary key, so it is enforced even
before secondary indexes finish.

Reference: [Paystack transactions](https://paystack.com/docs/api/transaction/)
and [webhook verification](https://paystack.com/docs/payments/webhooks/).

## Local verification

Standard tests run without gateway credentials or database access. The opt-in
`server/__tests__/storefrontMongo.integration.test.js` accepts only a loopback
MongoDB URI with a `drinks_rest_test_*` database name. Run it with
`DRINKSHARBOUR_TEST_MONGO_URI` pointing to an isolated local replica set. It
cleans up its database; it never uses the production connection variable.
