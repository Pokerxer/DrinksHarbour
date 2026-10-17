// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useState } from 'react';
import { usePOSReceiptLink } from './use-pos-receipt-link';
afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});
it('opens the requested original receipt and searches all order history', () => {
  window.history.replaceState(
    {},
    '',
    '/point-of-sale/orders?receipt=RCP-1&order=order-1'
  );
  function Demo() {
    const [scope, setScope] = useState<'all' | 'session'>('session');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<{
      _id: string;
      receiptNumber: string;
    } | null>(null);
    usePOSReceiptLink(
      [{ _id: 'order-1', receiptNumber: 'RCP-1' }],
      'business',
      setScope,
      setSearch,
      setSelected
    );
    return (
      <p>
        {scope} / {search} / {selected?.receiptNumber}
      </p>
    );
  }
  render(<Demo />);
  expect(screen.getByText('all / RCP-1 / RCP-1')).toBeTruthy();
});
it('does not select a stale receipt when the business context changes', () => {
  window.history.replaceState(
    {},
    '',
    '/point-of-sale/orders?receipt=RCP-1&order=order-1'
  );
  const orders = [{ _id: 'order-1', receiptNumber: 'RCP-1' }];
  function Demo({ context }: { context: string }) {
    const [, setScope] = useState<'all' | 'session'>('session');
    const [, setSearch] = useState('');
    const [selected, setSelected] = useState<(typeof orders)[number] | null>(
      null
    );
    usePOSReceiptLink(orders, context, setScope, setSearch, setSelected);
    return <p>{selected?.receiptNumber || 'No selected receipt'}</p>;
  }
  const view = render(<Demo context="original" />);
  expect(screen.getByText('RCP-1')).toBeTruthy();
  view.rerender(<Demo context="another-business" />);
  expect(screen.getByText('No selected receipt')).toBeTruthy();
});
