'use client';

import AccountingNavHeader from './accounting-nav-header';

/** Shared module chrome for the Customers/Vendors accounting pages. */
export default function AccountingPageShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen min-w-0 bg-gray-50">
      <AccountingNavHeader />
      <main className="mx-auto w-full min-w-0 max-w-screen-2xl px-3 py-5 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
          <div>
            <h1 className="font-lexend text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <span className="mt-2 block max-w-2xl text-sm text-gray-500">
                {subtitle}
              </span>
            )}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
