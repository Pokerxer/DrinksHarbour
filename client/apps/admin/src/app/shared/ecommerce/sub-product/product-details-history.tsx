'use client';

import React, { useState } from 'react';
import HistoryActions, { type ProductHistoryType } from './history-actions';
import ProductHistoryPanel from './create-edit/ProductHistoryPanel';

export default function ProductDetailsHistory({
  subProductId,
  productName,
  token,
}: {
  subProductId: string;
  productName: string;
  token?: string;
}) {
  const [history, setHistory] = useState<ProductHistoryType | null>(null);
  const canView = Boolean(subProductId && token);

  return (
    <section
      className="mb-6 rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:p-5"
      aria-label="Purchase and sales activity"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Product activity
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Review purchase orders and sales for this product.
          </p>
        </div>
        <HistoryActions disabled={!canView} onOpen={setHistory} />
      </div>
      {history && canView && token && (
        <ProductHistoryPanel
          key={`${subProductId}:${history}`}
          type={history}
          subProductId={subProductId}
          productName={productName}
          token={token}
          onClose={() => setHistory(null)}
        />
      )}
    </section>
  );
}
