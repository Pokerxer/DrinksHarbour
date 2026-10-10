'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from 'rizzui';
import { PiCopyBold, PiCodeDuotone } from 'react-icons/pi';

const endpoints = [
  ['GET', '/banners', 'Published banners for your store', 'storefront:read'],
  ['GET', '/store', 'Store name, logo and colour', 'storefront:read'],
  [
    'GET',
    '/products?page=1&limit=20',
    'Products, variants and retail prices',
    'storefront:read',
  ],
  [
    'GET',
    '/products/:id',
    'Product details by SubProduct ID',
    'storefront:read',
  ],
  ['POST', '/cart/quote', 'Check stock and calculate totals', 'checkout:write'],
  ['POST', '/checkout', 'Create an order and open Paystack', 'checkout:write'],
  ['GET', '/checkout/:id', 'Checkout and order status', 'checkout:write'],
  [
    'POST',
    '/checkout/:id/verify',
    'Verify payment after return',
    'checkout:write',
  ],
  [
    'POST',
    '/checkout/:id/cancel',
    'Release a failed or abandoned checkout',
    'checkout:write',
  ],
];
const examples = {
  Products: `// Run on your website server. Never use a NEXT_PUBLIC key.
const response = await fetch(
  process.env.DRINKSHARBOUR_API_URL + '/products?page=1&limit=20',
  {
    headers: { Authorization: 'Bearer ' + process.env.DRINKSHARBOUR_API_KEY },
    cache: 'no-store'
  }
);
const result = await response.json();
if (!response.ok) throw new Error(result.message);
// result.data = products; result.pagination = page information`,
  Checkout: `// Run on your website server with a saved ID for this checkout attempt.
const response = await fetch(process.env.DRINKSHARBOUR_API_URL + '/checkout', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + process.env.DRINKSHARBOUR_API_KEY,
    'Content-Type': 'application/json',
    'Idempotency-Key': checkoutAttemptId // reuse for retries
  },
  body: JSON.stringify({
    items: [{ subProductId, sizeId, quantity: 1 }],
    customer: { firstName, lastName, email, phone },
    shippingMethod: 'standard',
    shipping: { address, city, state, country: 'Nigeria' },
    ageVerified: true, // only after your customer confirms their age
    returnUrl: 'https://your-website.example/payment/return'
  })
});
const result = await response.json();
if (!response.ok) throw new Error(result.message);
// Save result.data.id with this browser session.
// Redirect only if result.data.authorizationUrl exists.
// Verify through POST /checkout/:id/verify before showing payment success.`,
};
export default function WebsiteApiGuide({
  showDocumentationLink = true,
}: {
  showDocumentationLink?: boolean;
}) {
  const base = `${(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001').replace(/\/$/, '')}/api/integrations/v1`;
  const [example, setExample] = useState<keyof typeof examples>('Products');
  const [notice, setNotice] = useState('');
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('Copied.');
    } catch {
      setNotice('Select the text and copy it manually.');
    }
  }
  return (
    <section className="rounded-2xl border border-muted bg-white p-5 dark:bg-gray-50 sm:p-6">
      <div className="flex items-start gap-3">
        <PiCodeDuotone className="mt-1 size-6 shrink-0 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Build your tenant website</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Create a key with the Tenant website preset. Your website server
            calls this API; your customers browse and pay through your own
            website.
          </p>
        </div>
      </div>
      {showDocumentationLink && (
        <Link
          href="/settings/api-keys/documentation"
          className="mt-4 inline-flex text-sm font-semibold text-primary underline underline-offset-4"
        >
          Full API documentation →
        </Link>
      )}
      <div className="mt-5 rounded-xl bg-gray-50 p-4">
        <p className="mb-2 text-sm font-medium">REST API base URL</p>
        <div className="flex flex-wrap items-center gap-3">
          <code className="min-w-0 break-all text-xs">{base}</code>
          <Button size="sm" variant="outline" onClick={() => void copy(base)}>
            <PiCopyBold className="mr-2 size-4" />
            Copy URL
          </Button>
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-500">
          Set DRINKSHARBOUR_API_URL to this URL and DRINKSHARBOUR_API_KEY to
          your saved secret on the website server. Each key accesses its own
          tenant automatically.
        </p>
      </div>
      <ol className="mt-5 grid list-inside list-decimal gap-3 text-sm text-gray-600 md:grid-cols-3">
        <li>Load products and keep the cart on your website.</li>
        <li>
          Quote the cart, then create checkout with a saved Idempotency-Key.
        </li>
        <li>Redirect to Paystack, then verify the saved checkout ID.</li>
      </ol>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Tenant website REST endpoints</caption>
          <thead>
            <tr className="border-b border-muted text-gray-500">
              <th className="p-3">Method</th>
              <th className="p-3">Endpoint</th>
              <th className="p-3">Use</th>
              <th className="p-3">Permission</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map(([method, path, description, scope]) => (
              <tr key={path} className="border-b border-muted last:border-0">
                <td className="p-3 font-semibold">{method}</td>
                <td className="p-3 font-mono text-xs">{path}</td>
                <td className="p-3">{description}</td>
                <td className="p-3 font-mono text-xs">{scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {Object.keys(examples).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={example === value ? 'solid' : 'outline'}
            onClick={() => setExample(value as keyof typeof examples)}
          >
            {value} example
          </Button>
        ))}
        <Button
          size="sm"
          variant="text"
          onClick={() => void copy(examples[example])}
        >
          Copy example
        </Button>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-6 text-gray-100">
        <code>{examples[example]}</code>
      </pre>
      <p role="status" className="mt-2 text-xs text-gray-500">
        {notice}
      </p>
      <p className="mt-4 text-xs leading-6 text-gray-500">
        Prices and delivery totals are calculated by DrinksHarbour. Send product
        IDs and quantities, then use the returned total. Alcoholic products
        require age confirmation. Customer accounts, loyalty and automated
        refunds are not exposed by these keys.
      </p>
    </section>
  );
}
