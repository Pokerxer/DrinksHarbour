import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, expect, it, vi } from 'vitest';
import Toolbar from './product-details-toolbar';
import { takeDuplicateSource } from './create-edit/duplicate-intent';
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
vi.stubGlobal('React', React);
afterAll(() => vi.unstubAllGlobals());
const props = {
  id: 'tenant-instance',
  name: 'Wine',
  status: 'active',
  published: true,
  stock: 12,
  price: 5000,
  currency: 'NGN',
  token: 'token',
  onChanged: vi.fn(),
};
it('renders detail actions and the shared history controls without navigation or duplication', () => {
  takeDuplicateSource();
  const html = renderToStaticMarkup(<Toolbar {...props} />);
  expect(html).toContain('Edit product');
  expect(html).toContain('More product actions');
  expect(html).toContain('View purchased history');
  expect(html).toContain('View sold history');
  expect(html).not.toContain('All changes saved');
  expect(push).not.toHaveBeenCalled();
  expect(takeDuplicateSource()).toBeNull();
});
it('keeps authenticated actions disabled without a session', () => {
  const html = renderToStaticMarkup(<Toolbar {...props} token={undefined} />);
  expect(html.match(/\sdisabled=""/g)?.length).toBe(5);
});
