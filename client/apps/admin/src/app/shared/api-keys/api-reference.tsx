import type { ReactNode } from 'react';

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 space-y-4 rounded-2xl border border-muted bg-white p-5 dark:bg-gray-50 sm:p-6"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-4 text-sm leading-7 text-gray-600">
        {children}
      </div>
    </section>
  );
}
function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-6 text-gray-100">
      <code>{children}</code>
    </pre>
  );
}

export default function ApiReference() {
  return (
    <>
      <Section id="catalogue" title="Catalogue & cart">
        <p>
          GET /store returns the tenant name, slug, logo, colour, currency and
          shipping methods. GET /products returns offers in data and page,
          limit, total, totalPages in pagination. GET /products/:id returns one
          offer in data. Both catalogue routes require storefront:read.
        </p>
        <p>
          Filter products with q (literal name search, up to 100 characters),
          type, category (central category ID), page (positive integer) and
          limit (1–100, default 20). Results sort by name and offer ID. Only
          published active tenant offers are exposed, including that tenant’s
          own pending catalogue submissions. Costs and supplier details stay
          private.
        </p>
        <p>
          An offer’s id is its SubProduct ID. Send it as subProductId, and send
          a variants[].id as sizeId. Select a variant when requiresVariant is
          true. Without a size selection, baseSellingPrice applies; sellingPrice
          is the lowest base or variant price. Check availability and the
          selected variant’s availableStock and maxOrderQuantity. Your website
          stores its cart.
        </p>
        <Code>{`// POST /cart/quote — checkout:write
{
  "items": [{ "subProductId": "OFFER_ID", "sizeId": "VARIANT_ID", "quantity": 2 }],
  "shippingMethod": "standard",
  "shipping": {
    "address": "10 Example Street", "city": "Abuja",
    "state": "FCT", "country": "Nigeria"
  },
  "ageVerified": true
}
// Response: { success: true, data: {
//   currency, items, subtotal, shippingFee, total, shipping
// } }`}</Code>
        <p>
          Omit sizeId for offers that allow buying without variants. Quantities
          are whole numbers from 1–1,000, with at most 50 input lines. Duplicate
          lines combine; parent and variant stock limits both apply. Alcoholic
          items require explicit customer age confirmation before setting
          ageVerified to true.
        </p>
        <p>
          Use standard delivery with a Nigerian state, or pickup for zero
          delivery fees. Delivery checkout also requires an address and city.
          DrinksHarbour calculates retail discounts and delivery charges. Send
          IDs and quantities; prices, totals, tenant IDs, coupon codes and other
          unsupported fields are rejected. A quote checks stock but does not
          reserve it.
        </p>
      </Section>
      <Section id="checkout" title="Checkout & payment">
        <p>
          POST /checkout uses checkout:write and an Idempotency-Key header
          containing 8–128 letters, numbers, dots, dashes or underscores. Save a
          unique attempt ID on your server before sending the request and reuse
          it for retries.
        </p>
        <Code>{`// POST /checkout — same cart fields, plus:
{
  "items": [{ "subProductId": "OFFER_ID", "sizeId": "VARIANT_ID", "quantity": 2 }],
  "shippingMethod": "pickup",
  "ageVerified": true,
  "customer": {
    "firstName": "Ada", "lastName": "Example",
    "email": "ada@example.com", "phone": "08012345678"
  },
  "returnUrl": "https://your-website.example/payment/return"
}
// data: id, orderId, orderNumber, total, currency, reference,
//       status, authorizationUrl, optional replayed`}</Code>
        <p>
          Customer first name, last name, email and phone are required.
          returnUrl must be HTTPS; localhost HTTP is allowed outside production.
          Checkout recalculates prices and atomically reserves stock before
          opening Paystack. The API sends Paystack the computed amount in kobo
          and a unique reference.
        </p>
        <ul className="list-inside list-disc space-y-2">
          <li>
            201: new checkout ready. Save data.id in the customer session, then
            redirect to data.authorizationUrl.
          </li>
          <li>
            200: replay of an existing checkout. Reusing the attempt ID with
            different input returns 409.
          </li>
          <li>
            202: pending, initializing or uncertain. Preserve the handle; do not
            redirect without authorizationUrl or create another attempt.
          </li>
        </ul>
        <p>
          Use this helper only in your website backend. Your own route handlers
          should choose allowed paths and authorize the customer session.
        </p>
        <Code>{`async function drinks(path, { method = 'GET', body, idempotencyKey } = {}) {
  const response = await fetch(process.env.DRINKSHARBOUR_API_URL + path, {
    method,
    cache: 'no-store',
    headers: {
      Authorization: 'Bearer ' + process.env.DRINKSHARBOUR_API_KEY,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message);
  return result;
}`}</Code>
        <Code>{`// After Paystack returns: server-side, using the saved checkout ID
const verified = await drinks('/checkout/' + savedCheckoutId + '/verify', {
  method: 'POST'
});
if (verified.data.status === 'paid') {
  // Show payment success.
}
const order = await drinks('/checkout/' + savedCheckoutId);
// data.orderStatus and data.paymentStatus expose progress.`}</Code>
        <p>
          GET /checkout/:id and POST /checkout/:id/verify require checkout:write
          and the original issuing key. Only status paid confirms automatic
          settlement. Never trust callback query parameters: the server verifies
          the exact payment reference, amount and currency. Signed webhooks also
          settle payments if the customer closes their browser. needs_review
          requires staff attention.
        </p>
      </Section>
      <Section id="recovery" title="Cancellation & recovery">
        <p>
          POST /checkout/:id/cancel requires checkout:write and the issuing key.
          The server verifies Paystack first. Failed, abandoned or confirmed
          not-found payments can release their reservation once. Paid or ongoing
          payments cannot be cancelled. Keep the old attempt ID during
          uncertainty; create a new attempt only after confirmed cancellation.
        </p>
        <p>
          Every 15 minutes, the reconciliation job checks unpaid attempts older
          than 24 hours in production or with ENABLE_CRON=true. Provider outages
          and ongoing payments retain reservations. A payment arriving after
          cancellation becomes needs_review and leaves the order unfulfilled for
          staff refund handling.
        </p>
        <p>
          Rotating keys prevents the new key from reading old-key checkouts.
          Retain the original key through outstanding customer returns when
          possible; webhooks still settle existing orders, and staff can review
          them in the dashboard. Customer accounts, loyalty, coupons and
          automated refunds are outside this API.
        </p>
      </Section>
      <Section id="errors" title="Errors & limits">
        <Code>{`{ "success": false, "code": "invalid_request", "message": "..." }`}</Code>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[5rem_1fr]">
          {[
            ['400', 'Invalid payload or unsupported field.'],
            ['401', 'Missing, invalid, expired or revoked key.'],
            ['403', 'Missing scope or inactive tenant API access.'],
            [
              '404',
              'Product, variant or checkout outside the permitted scope.',
            ],
            ['409', 'Stock, payment, checkout state or idempotency conflict.'],
            [
              '429',
              '60 requests per UTC minute per key exceeded. Respect Retry-After.',
            ],
            [
              '502 / 503',
              'Service unavailable. Preserve your checkout attempt ID.',
            ],
          ].map(([status, meaning]) => (
            <div key={status} className="contents">
              <dt className="font-mono font-semibold">{status}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
        <p>
          Responses are private and no-store. Each request rechecks revocation,
          expiry, tenant approval, subscription and plan access. Your website
          backend should rate-limit visitors and expose only the routes its
          storefront needs.
        </p>
      </Section>
      <Section id="deployment" title="Deployment checklist">
        <ul className="list-inside list-disc space-y-2">
          <li>
            Use MongoDB Atlas or a replica set for atomic stock and checkout
            transactions.
          </li>
          <li>Configure PAYSTACK_SECRET_KEY on the DrinksHarbour backend.</li>
          <li>
            Register /api/payments/webhooks/paystack on your API host in
            Paystack. Verify signatures against original request bytes.
          </li>
          <li>
            Enable the reconciliation job, build model indexes and configure
            private website environment variables.
          </li>
          <li>
            Use Paystack test credentials to test successful, abandoned and
            failed payments before accepting live payments.
          </li>
        </ul>
        <p>
          Custom domains use server-to-server requests, so the website does not
          need browser CORS access to the secret-key API. Test key creation,
          permissions, expiry and revocation alongside the complete customer
          payment journey.
        </p>
      </Section>
    </>
  );
}
