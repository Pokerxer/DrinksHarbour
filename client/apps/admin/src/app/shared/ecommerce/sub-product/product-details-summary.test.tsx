import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import SubProductDetailsSummary from './product-details-summary';
import DuplicateSubProductButton from './duplicate-button';
import { takeDuplicateSource } from './create-edit/duplicate-intent';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  push.mockReset();
  takeDuplicateSource();
});

it('renders duplication without starting it or exposing a replayable URL', () => {
  const html = renderToStaticMarkup(
    <SubProductDetailsSummary
      product={{ id: 'source-id', name: 'Original product' }}
    />
  );
  expect(html).not.toContain('duplicateFrom');
  expect(html).toContain('Duplicate');
  expect(html).toContain('/sub-products/source-id/edit');
  expect(takeDuplicateSource()).toBeNull();
  expect(push).not.toHaveBeenCalled();
});

it('starts duplication only on the button click', () => {
  const button = DuplicateSubProductButton({ sourceId: 'source-id' });
  expect(button.props.type).toBe('button');
  expect(takeDuplicateSource()).toBeNull();
  button.props.onClick();
  expect(push).toHaveBeenCalledWith('/sub-products/create');
  expect(takeDuplicateSource()).toBe('source-id');
  expect(takeDuplicateSource()).toBeNull();
});
