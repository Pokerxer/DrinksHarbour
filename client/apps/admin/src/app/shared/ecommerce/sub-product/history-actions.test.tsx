import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import HistoryActions from './history-actions';

it('opens the requested history only on a deliberate button click', () => {
  const onOpen = vi.fn();
  const view = HistoryActions({ onOpen, disabled: false });
  const buttons = view.props.children;
  expect(onOpen).not.toHaveBeenCalled();
  expect(
    buttons.map(
      (
        button: React.ReactElement<
          React.ButtonHTMLAttributes<HTMLButtonElement>
        >
      ) => button.props.type
    )
  ).toEqual(['button', 'button']);
  buttons[0].props.onClick();
  expect(onOpen).toHaveBeenLastCalledWith('purchased');
  buttons[1].props.onClick();
  expect(onOpen).toHaveBeenLastCalledWith('sold');
});

it('provides accessible modal buttons and disables them without access', () => {
  const html = renderToStaticMarkup(
    <HistoryActions disabled onOpen={() => {}} />
  );
  expect(html).toContain('Purchase history');
  expect(html).toContain('Sales history');
  expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(2);
  expect(html.match(/disabled=""/g)).toHaveLength(2);
});

import ProductDetailsHistory from './product-details-history';
it('keeps history closed on initial render and disables signed-out access', () => {
  const html = renderToStaticMarkup(
    <ProductDetailsHistory subProductId="tenant-product" productName="Wine" />
  );
  expect(html).not.toContain('role="dialog"');
  expect(html.match(/disabled=""/g)).toHaveLength(2);
});
