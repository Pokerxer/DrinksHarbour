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
import ExtensionErrorFilter from '@/components/extension-error-filter';
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
        <AuthProvider session={session}>
          <TenantProvider initialTenant={initialTenant}>
            <ThemeProvider>
              {/* <NextProgress /> */}
              <JotaiProvider>
                {children}
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
