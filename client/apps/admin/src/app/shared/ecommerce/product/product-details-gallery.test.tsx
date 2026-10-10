// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProductDetailsGallery from './product-details-gallery';

vi.mock('next/image', () => ({
  default: ({ fill, priority, ...props }: Record<string, unknown>) => (
    <img {...props} />
  ),
}));
afterEach(cleanup);
const images = [
  { url: '/first.jpg', isPrimary: false },
  { url: '/second.jpg', isPrimary: true },
];

describe('product primary image controls', () => {
  it('selects the original image index even when invalid images are hidden', () => {
    const select = vi.fn();
    render(
      <ProductDetailsGallery
        images={[{ url: '' }, ...images]}
        onMakePrimary={select}
      />
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Make image 2 primary' })
    );
    expect(select).toHaveBeenCalledWith(1);
    expect(screen.getByText('Primary image')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Make image 3 primary' })
    ).toBeNull();
  });
  it('disables selection while saving', () => {
    const select = vi.fn();
    render(
      <ProductDetailsGallery
        images={images}
        onMakePrimary={select}
        isSavingPrimary
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(select).not.toHaveBeenCalled();
  });
  it('keeps the gallery read-only without an update callback', () => {
    render(<ProductDetailsGallery images={images} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('handles null images as an empty gallery', () => {
    render(<ProductDetailsGallery images={null} />);
    expect(screen.getByText('No images yet')).toBeTruthy();
  });
  it('displays usable demo images when no images prop is supplied', () => {
    render(<ProductDetailsGallery />);
    expect(
      screen.getAllByRole('img').every((image) => image.getAttribute('src'))
    ).toBe(true);
  });
});
