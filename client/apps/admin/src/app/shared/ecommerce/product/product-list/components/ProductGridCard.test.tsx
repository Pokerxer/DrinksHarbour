// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ProductGridCard, { ProductGridCardCompact } from './ProductGridCard';

afterEach(cleanup);

for (const Card of [ProductGridCard, ProductGridCardCompact]) {
  it.each([
    ['approved', false, 'Active'],
    ['archived', true, 'Archived'],
    ['discontinued', false, 'Discontinued'],
  ])(`shows %s with published=%s in ${Card.name}`, (status, isPublished, label) => {
    render(
      <Card
        product={{
          _id: 'product',
          name: 'Example Product',
          slug: 'example-product',
          status,
          isPublished,
          createdAt: '',
          updatedAt: '',
        }}
        isSelected={false}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText(label)).toBeTruthy();
  });
}
