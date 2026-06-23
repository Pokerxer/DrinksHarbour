import { headers } from 'next/headers';
import Image from 'next/image';
import SignInForm from '@/app/signin/sign-in-form';
import { metaObject } from '@/config/site.config';
import type { AdminTenantData } from '@/context/TenantContext';
import {
  PiCashRegisterDuotone,
  PiPackageDuotone,
  PiChartLineUpDuotone,
} from 'react-icons/pi';

export const metadata = {
  ...metaObject('Admin Sign In'),
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// DrinksHarbour brand red — the same family used by the POS lock screen.
const BRAND_RED = '#b20202';

async function fetchTenantBySlug(slug: string): Promise<AdminTenantData | null> {
  try {
    const res = await fetch(`${API_URL}/api/tenants/slug/${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { tenant?: AdminTenantData } };
    return json?.data?.tenant ?? null;
  } catch {
    return null;
  }
}

const VALUE_PROPS = [
  {
    icon: PiPackageDuotone,
    title: 'Products & inventory',
    body: 'Track stock across warehouses in real time.',
  },
  {
    icon: PiCashRegisterDuotone,
    title: 'Orders & Point of Sale',
    body: 'Sell in-store and online from one place.',
  },
  {
    icon: PiChartLineUpDuotone,
    title: 'Live analytics',
    body: 'Make decisions with up-to-the-minute data.',
  },
];

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ _tenant?: string }>;
}) {
  const [headersList, params] = await Promise.all([headers(), searchParams]);

  // 1. Prefer x-tenant-slug injected by middleware (for authenticated subdomain visits)
  let tenantSlug: string | null = headersList.get('x-tenant-slug');

  // 2. Extract from actual host header (for unauthenticated subdomain visits)
  if (!tenantSlug) {
    const host = (headersList.get('host') || '').split(':')[0];
    const match = host.match(/^([a-z0-9-]+)\.drinksharbour\.com$/i);
    if (match && !['admin', 'www'].includes(match[1])) {
      tenantSlug = match[1];
    }
  }

  // 3. Local dev fallback: ?_tenant=acme
  if (!tenantSlug && params._tenant) {
    tenantSlug = params._tenant;
  }

  const tenant = tenantSlug ? await fetchTenantBySlug(tenantSlug) : null;
  const accent = tenant?.primaryColor || BRAND_RED;
  const year = new Date().getFullYear();

  return (
    <main className="flex min-h-screen w-full bg-white">
      {/* ── Left brand panel (lg+) ─────────────────────────────────────────── */}
      <aside
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 text-white xl:p-16 lg:flex"
        style={{ backgroundColor: accent }}
      >
        {/* depth + atmosphere */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40" />
        <div className="pointer-events-none absolute -left-28 -top-28 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-10 h-[520px] w-[520px] rounded-full bg-black/25 blur-3xl" />

        {/* logo / tenant identity */}
        <div className="relative z-10 flex items-center gap-3">
          {tenant?.logo?.url ? (
            <span className="relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white/15 ring-1 ring-white/25">
              <Image
                src={tenant.logo.url}
                alt={tenant.logo.alt || tenant.name}
                fill
                className="object-contain p-1.5"
              />
            </span>
          ) : (
            <Image
              src="/logo-short-light.svg"
              alt="DrinksHarbour"
              width={44}
              height={44}
              priority
            />
          )}
          <span className="text-lg font-semibold tracking-tight">
            {tenant?.name || 'DrinksHarbour'}
          </span>
        </div>

        {/* headline + value props */}
        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-[2.75rem]">
            {tenant
              ? `Run ${tenant.name} from one dashboard.`
              : 'Run your whole business from one dashboard.'}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/75">
            {tenant
              ? `Manage ${tenant.name}'s products, orders, and analytics — all in one place.`
              : 'Manage products, orders, point of sale, and analytics — all in one place.'}
          </p>

          <ul className="mt-10 space-y-5">
            {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
                  <Icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-white/70">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* footer */}
        <p className="relative z-10 text-sm text-white/55">
          © {year} DrinksHarbour. All rights reserved.
        </p>
      </aside>

      {/* ── Right form panel ───────────────────────────────────────────────── */}
      <section className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* mobile logo (brand panel hidden below lg) */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Image
              src="/logo-primary.svg"
              alt="DrinksHarbour"
              width={40}
              height={40}
              priority
            />
            <span className="text-lg font-semibold tracking-tight text-gray-900">
              {tenant?.name || 'DrinksHarbour'}
            </span>
          </div>

          <SignInForm tenant={tenant} />
        </div>
      </section>
    </main>
  );
}
