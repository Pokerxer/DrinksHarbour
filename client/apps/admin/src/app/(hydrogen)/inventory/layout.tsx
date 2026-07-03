'use client';

import InventoryNavHeader from '@/app/shared/inventory/inventory-nav-header';

/**
 * Shared chrome for every /inventory/* route. Hoisting the nav header here
 * keeps the Operations / Reporting / Configuration menus visible across all
 * inventory pages instead of each page re-rendering its own copy (same
 * pattern as /warehouses).
 */
export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex min-h-screen flex-col bg-gray-50 md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
        <InventoryNavHeader />
      </div>
      {children}
    </div>
  );
}
