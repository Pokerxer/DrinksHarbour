import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it, vi } from 'vitest';
import SubProductToolbar, { type SubProductToolbarProps } from './toolbar';
import ToolbarNavigation from './toolbar-navigation';

vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());
const noop = () => {};
const props: SubProductToolbarProps = {
  title: 'Swan-Neck Dual-Spout Glass Wine Decanter',
  status: 'active',
  editing: true,
  dirty: false,
  busy: false,
  saving: false,
  generating: false,
  saveStatus: 'idle',
  lastSaved: null,
  onBack: noop,
  onNew: noop,
  onSave: noop,
  onGenerate: noop,
  menu: { onDuplicate: noop, onArchive: noop, onDelete: noop },
  stats: {
    stock: 0,
    price: 50000,
    currency: 'NGN',
    purchased: 0,
    sold: 0,
    onHistory: noop,
  },
  navigation: {
    index: 0,
    count: 94,
    context: '94 products',
    onPrevious: noop,
    onNext: noop,
  },
};

describe('sub-product toolbar', () => {
  it('keeps labeled actions, stock and history available at every width', () => {
    const html = renderToStaticMarkup(<SubProductToolbar {...props} />);
    for (const label of [
      'New',
      'Save',
      'On hand',
      'Price',
      'Purchased',
      'Returns',
      'Sold',
      '1 / 94',
      'More product actions',
    ])
      expect(html).toContain(label);
    expect(html).toContain('₦50,000');
    expect(html).toContain('aria-label="Back to sub-products"');
  });
  it('does not show record-only menus and history for an unsaved creation', () => {
    const html = renderToStaticMarkup(
      <SubProductToolbar {...props} editing={false} status="draft" />
    );
    expect(html).not.toContain('More product actions');
    expect(html).not.toContain('View returns history');
    expect(html).not.toContain('Previous product');
    expect(html).toContain('New product · not saved');
  });
  it('disables all toolbar actions during a save', () => {
    const html = renderToStaticMarkup(
      <SubProductToolbar {...props} busy saving />
    );
    const buttons = html.match(/<button\b[^>]*>/g) || [];
    expect(buttons.length).toBeGreaterThan(5);
    expect(buttons.every((button) => button.includes('disabled'))).toBe(true);
    expect(html).toContain('Saving changes');
  });
  it('shows unsaved changes and uses the selected currency', () => {
    const html = renderToStaticMarkup(
      <SubProductToolbar
        {...props}
        dirty
        stats={{ ...props.stats, currency: 'USD', price: 12.5 }}
      />
    );
    expect(html).toContain('Unsaved changes');
    expect(html).toContain('12.50');
    expect(html).not.toContain('₦');
  });
  it('bounds record navigation and hides invalid positions', () => {
    expect(
      ToolbarNavigation({ ...props.navigation, index: -1, disabled: false })
    ).toBeNull();
    const html = renderToStaticMarkup(
      <ToolbarNavigation {...props.navigation} index={93} disabled={false} />
    );
    expect(html).toMatch(/<button[^>]*aria-label="Next product"[^>]*disabled/);
  });
});
