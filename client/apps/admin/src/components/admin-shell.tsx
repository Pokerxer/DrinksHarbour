'use client';
import React from 'react';
import { usePathname } from 'next/navigation';
import type { Session } from 'next-auth';
import { Toaster } from 'react-hot-toast';
import AuthProvider from '@/app/api/auth/[...nextauth]/auth-provider';
import GlobalDrawer from '@/app/shared/drawer-views/container';
import GlobalModal from '@/app/shared/modal-views/container';
import { JotaiProvider, ThemeProvider } from '@/app/shared/theme-provider';
import { TenantProvider, type AdminTenantData } from '@/context/TenantContext';
import DocumentExportHost from '@/app/shared/document-templates/document-export-host';
import ExtensionErrorFilter from '@/components/extension-error-filter';
import EntitlementErrorToast from '@/components/entitlement-error-toast';

export default function AdminShell({
  children,
  session,
  initialTenant,
}: {
  children: React.ReactNode;
  session: Session | null;
  initialTenant: AdminTenantData | null;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith('/kiosk/price-checker/')) return <>{children}</>;
  return (
    <>
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
              {children}
              <DocumentExportHost />
              <Toaster />
              <GlobalDrawer />
              <GlobalModal />
            </JotaiProvider>
          </ThemeProvider>
        </TenantProvider>
      </AuthProvider>
    </>
  );
}
