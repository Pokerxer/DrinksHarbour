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
import { TenantProvider } from '@/context/TenantContext';
import type { AdminTenantData } from '@/context/TenantContext';
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
  const tenantSlug = headersList.get('x-tenant-slug');
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
