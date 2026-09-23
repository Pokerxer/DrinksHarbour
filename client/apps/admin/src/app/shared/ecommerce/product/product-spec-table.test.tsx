import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it, vi } from 'vitest';
import ProductSpecTable from './product-spec-table';

vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());

describe('product taxonomy specifications', () => {
  it('renders readable type, subtype and style from the linked product', () => {
    const html = renderToStaticMarkup(<ProductSpecTable product={{ type: 'beer', subType: 'india_pale_ale', style: 'american_ipa', isBeverage: true }} />);
    expect(html).toContain('Beer');
    expect(html).toContain('India Pale Ale');
    expect(html).toContain('Style');
    expect(html).toContain('American IPA');
  });
  it('handles non-beverage products and omits missing taxonomy', () => {
    const html = renderToStaticMarkup(<ProductSpecTable product={{ type: 'bar_tool', isBeverage: false }} />);
    expect(html).toContain('Bar Tool');
    expect(html).not.toContain('Sub-Type');
    expect(html).not.toContain('Style');
  });
});
