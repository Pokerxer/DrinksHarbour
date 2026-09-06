import { headers } from 'next/headers';
import { Toaster } from 'react-hot-toast';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import AuthProvider from '@/app/api/auth/[...nextauth]/auth-provider';
import GlobalDrawer from '@/app/shared/drawer-views/container';
import GlobalModal from '@/app/shared/modal-views/container';
import { JotaiProvider, ThemeProvider } from '@/app/shared/theme-provider';
import { siteConfig } from '@/config/site.config';
import { inter, lexendDeca } from '@/app/fonts';
import cn from '@core/utils/class-names';
import { TenantProvider, type AdminTenantData } from '@/context/TenantContext';
import { resolveTenantSlug } from '@/context/tenant-slug';
import { checkPlanAccess } from '@/config/plan-capabilities';
import UpgradeRequired from '@/app/shared/upgrade-required/upgrade-required';
import ExtensionErrorFilter from '@/components/extension-error-filter';
import EntitlementErrorToast from '@/components/entitlement-error-toast';
import ReadOnlyBanner from '@/components/read-only-banner';
import { getErmStatus } from '@/services/erm.service';
// import NextProgress from '@core/components/next-progress';
// import ChatbotWidget from '@/components/Chatbot/ChatbotWidget';

// styles
// import 'swiper/css';
// import 'swiper/css/navigation';
import '@/app/globals.css';

export const metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#b20202',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

// Runs at HTML-parse time, BEFORE the Next.js bundle (and therefore before
// the dev overlay) registers its window 'error' / 'unhandledrejection'
// listeners. Wallet extensions (MetaMask etc.) inject inpage.js at
// document_start and throw/log "Failed to connect to MetaMask" whenever
// their background service worker is unreachable. Those errors are
// dispatched at window, so listeners fire in registration order — by
// registering first we can stopImmediatePropagation() them away from the
// overlay entirely. Extension-only markers; a real app error never
// contains them. (See components/extension-error-filter.tsx for the
// post-hydration console.error re-wrap, which stays as defense-in-depth.)
const EXTENSION_NOISE_GUARD_SCRIPT = `(function () {
  var schemeRe = /^(chrome|moz|safari|edge|brave)-extension:\\/\\//i;
  var noiseRe = /MetaMask|metamask|inpage\\.js|contentscript\\.js/i;
  function textOf(value) {
    if (!value) return String(value);
    return value.stack || value.message || String(value);
  }
  function isNoise(text) {
    return !!(text && (schemeRe.test(text) || noiseRe.test(text)));
  }
  function onError(evt) {
    if (isNoise(textOf(evt.error)) || isNoise(evt.filename)) {
      evt.preventDefault();
      evt.stopImmediatePropagation();
    }
  }
  function onRejection(evt) {
    if (isNoise(textOf(evt.reason))) {
      evt.preventDefault();
      evt.stopImmediatePropagation();
    }
  }
  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection, true);
  var originalConsoleError = window.console.error.bind(window.console);
  window.console.error = function () {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      parts.push(textOf(arguments[i]));
    }
    if (!isNoise(parts.join(' '))) {
      originalConsoleError.apply(window.console, arguments);
    }
  };
})();`;

async function fetchTenantBySlug(
  slug: string
): Promise<AdminTenantData | null> {
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  const headersList = await headers();
  // The subdomain names the tenant when there is one; otherwise the signed-in
  // user's own tenant does. Without the second half, every tenant user working
  // at admin.drinksharbour.com (or localhost) had no tenant in context at all,
  // and everything branded — the sidebar, the dashboard hero, the printed
  // employee badge — fell back to the platform's name and colour instead of
  // the shop's. See `resolveTenantSlug` for why the subdomain wins.
  const tenantSlug = resolveTenantSlug({
    hostSlug: headersList.get('x-tenant-slug'),
    sessionTenantSlug: (session?.user as { tenantSlug?: string | null })
      ?.tenantSlug,
  });
  const initialTenant: AdminTenantData | null = tenantSlug
    ? await fetchTenantBySlug(tenantSlug)
    : null;

  // ── Authoritative plan gate ───────────────────────────────────────────────
  //
  // src/middleware.ts also gates on plan, but from the JWT's cached copy — it
  // runs on the edge and cannot reach the database. This check uses the tenant
  // document just fetched with `cache: 'no-store'`, so it is never stale, and
  // it is what actually decides. (The server API is the real boundary; this
  // decides what the browser is allowed to render.)
  //
  // It substitutes the upgrade screen for `children` instead of redirecting:
  // a redirect from a layout would fight the middleware's own redirect and can
  // loop, and keeping the URL intact means the page works the moment the plan
  // does.
  //
  // Platform staff are exempt inside checkPlanAccess. Note they can hold a
  // tenant here — a platform admin pivots into one via the subdomain — so
  // "there is a tenant" is NOT sufficient to gate on; the role has to be
  // consulted too, which is why the session role is passed rather than the
  // presence of initialTenant.
  // Gated only when a tenant actually resolved. `fetchTenantBySlug` returns
  // null on a network blip as well as on "no tenant", and the two are
  // indistinguishable here — so treating null as "no capabilities" would show
  // the upgrade screen to a paying tenant every time the API hiccups. Failing
  // open is safe at this tier precisely because it is not the boundary: the
  // edge gate has already run against the JWT, and the API refuses regardless.
  const pathname = headersList.get('x-pathname');
  const planAccess =
    pathname && initialTenant
      ? checkPlanAccess({
          path: pathname,
          role: (session?.user as { role?: string } | undefined)?.role,
          plan: initialTenant.plan,
        })
      : { allowed: true, requirement: null, upgradeTo: null };

  // ── Read-only warning ─────────────────────────────────────────────────────
  //
  // Warn a tenant who cannot save BEFORE they fill a form, not after they lose
  // it to a 403. The sentence is the server's — the same `readOnlyMessage` that
  // fills the refusal — so this banner, the toast on every screen and the
  // billing page all say one thing. Deriving it here from `subscriptionStatus`
  // would be a second copy of the copy AND of the policy, and would get the
  // policy wrong: an elapsed trial is still `trialing`.
  //
  // Only asked for when there is a tenant to ask about — platform staff have no
  // subscription — and null on any failure, so a hiccup shows no banner rather
  // than a wrong one.
  const sessionToken = (session?.user as { token?: string } | undefined)?.token;
  const ermStatus =
    initialTenant && sessionToken ? await getErmStatus(sessionToken) : null;
  const readOnlyMessage = ermStatus?.writesAllowed
    ? null
    : (ermStatus?.entitlementMessage ?? null);

  const bodyStyle = initialTenant?.primaryColor
    ? ({
        '--color-tenant-primary': initialTenant.primaryColor,
      } as React.CSSProperties)
    : undefined;

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={cn(inter.variable, lexendDeca.variable, 'font-inter')}
        style={bodyStyle}
      >
        {/* Inline, at HTML-parse time — BEFORE the Next.js bundle registers
            its dev-overlay error listeners — so wallet-extension errors
            (MetaMask etc.) are stopped at the window before the overlay can
            capture them. Renders nothing; never touches app errors. */}
        <script
          dangerouslySetInnerHTML={{ __html: EXTENSION_NOISE_GUARD_SCRIPT }}
        />
        {/* Filters wallet-extension (MetaMask etc.) console/overlay noise;
            renders nothing and never touches app errors. */}
        <ExtensionErrorFilter />
        {/* Turns the API's plan/billing 403s — which every service in
            src/services/ otherwise reduces to a bare message — into an
            explanation with a route to /settings/billing, on every screen.
            Renders nothing; wraps window.fetch and passes responses through
            untouched. */}
        <EntitlementErrorToast />
        <AuthProvider session={session}>
          <TenantProvider initialTenant={initialTenant}>
            <ThemeProvider>
              {/* <NextProgress /> */}
              <JotaiProvider>
                <ReadOnlyBanner message={readOnlyMessage} />
                {planAccess.allowed ? (
                  children
                ) : (
                  <UpgradeRequired
                    feature={planAccess.requirement?.label}
                    currentPlan={initialTenant?.plan}
                    upgradeTo={planAccess.upgradeTo}
                  />
                )}
                <Toaster />
                <GlobalDrawer />
                <GlobalModal />
              </JotaiProvider>
            </ThemeProvider>
          </TenantProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
