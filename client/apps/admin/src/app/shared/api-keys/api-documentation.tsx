import Link from 'next/link';
import WebsiteApiGuide from './website-api-guide';
import ApiBannerReference from './api-banner-reference';
import ApiReference from './api-reference';
import ApiCustomerReference from './api-customer-reference';

const sections = [
  ['connection', 'Connect your server'],
  ['banners', 'Store banners'],
  ['customers', 'Customer accounts'],
  ['catalogue', 'Catalogue & cart'],
  ['checkout', 'Checkout & payment'],
  ['recovery', 'Cancellation & recovery'],
  ['errors', 'Errors & limits'],
  ['deployment', 'Deployment checklist'],
] as const;

export default function ApiDocumentation() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="space-y-3">
        <Link
          href="/settings/api-keys"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          ← API keys
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Tenant website REST API
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-gray-500">
          Build a branded ecommerce website with your tenant catalogue, a
          shopping cart, delivery quotes, guest orders and hosted Paystack
          payments. All amounts are in Nigerian Naira (NGN); your tenant remains
          responsible for fulfillment.
        </p>
      </header>
      <nav
        aria-label="Documentation sections"
        className="flex flex-wrap gap-3 rounded-xl border border-muted p-4 text-sm"
      >
        {sections.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="text-primary underline underline-offset-4"
          >
            {label}
          </a>
        ))}
      </nav>
      <section id="connection" className="scroll-mt-24">
        <WebsiteApiGuide showDocumentationLink={false} />
        <p className="mt-4 text-sm leading-7 text-gray-500">
          Every request requires Authorization: Bearer &lt;key&gt;. POST
          requests use Content-Type: application/json. Keep your secret on your
          website server; never put it in browser code or public environment
          variables. Associate checkout IDs with your customer sessions and
          authorize access before proxying requests. The key selects its tenant
          automatically; no tenant selector is needed. These keys cannot access
          admin routes. API access requires an active eligible plan.
        </p>
      </section>
      <ApiBannerReference />
      <ApiCustomerReference />
      <ApiReference />
    </div>
  );
}
