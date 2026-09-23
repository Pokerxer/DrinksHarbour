import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import SalesDetail from './sales-history-detail';
import PurchaseDetail from './purchase-history-detail';
import History from './ProductHistoryPanel';
it('renders sales details with combined variants and pending payment', () => {
  const html = renderToStaticMarkup(
    <SalesDetail
      order={{
        paymentStatus: 'pending',
        items: [
          { subproduct: 'p', quantity: 2, itemSubtotal: 100 },
          { subproduct: 'p', quantity: 3, itemSubtotal: 150 },
        ],
      }}
      productId="p"
      onClose={() => {}}
    />
  );
  expect(html).toContain('Pending');
  expect(html).toContain('250.00');
});
it('uses stored purchase unit cost and preserves explicit zero totals', () => {
  const html = renderToStaticMarkup(
    <PurchaseDetail
      po={{
        items: [
          { subProductId: 'p', quantity: 2, unitCost: 125, totalCost: 0 },
        ],
      }}
      productId="p"
      onClose={() => {}}
    />
  );
  expect(html).toContain('125.00');
  expect(html).toContain('0.00');
});
it('can render the modal shell without browser globals', () => {
  expect(() =>
    renderToStaticMarkup(
      <History
        type="sold"
        subProductId="p"
        productName="Wine"
        token="token"
        onClose={() => {}}
      />
    )
  ).not.toThrow();
});
