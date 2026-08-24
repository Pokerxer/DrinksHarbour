'use client';
import dynamic from 'next/dynamic';

const TaxesView = dynamic(() => import('@/app/shared/accounting/taxes-view'));

export default function TaxesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-4 text-xl font-semibold">Taxes</h1>
        <TaxesView />
      </main>
    </div>
  );
}
