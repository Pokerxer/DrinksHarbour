'use client';

import AccountingNavHeader from './accounting-nav-header';

/** Shared module chrome for the Customers/Vendors accounting pages. */
export default function AccountingPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AccountingNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
        </div>
        {children}
      </main>
    </div>
  );
}
