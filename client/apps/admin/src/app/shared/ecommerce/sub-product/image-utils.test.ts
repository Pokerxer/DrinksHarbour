import { describe, it, expect } from 'vitest';
import {
  orderedImages,
  inheritedProductImages,
  resolveSubProductImage,
  resolveSubProductImages,
  resolveSubProductGallery,
  resolveSubProductThumb,
} from './image-utils';

describe('orderedImages', () => {
  it('returns an empty list for missing, empty or url-less input', () => {
    expect(orderedImages(undefined)).toEqual([]);
    expect(orderedImages([])).toEqual([]);
    expect(orderedImages([{ url: '   ' }, { url: undefined }])).toEqual([]);
  });

  it('puts the flagged primary first, whatever its order', () => {
    const out = orderedImages([
      { url: 'a.jpg', order: 0 },
      { url: 'b.jpg', order: 9, isPrimary: true },
    ]);
    expect(out.map((i) => i.url)).toEqual(['b.jpg', 'a.jpg']);
  });

  it('falls back to the lowest order when nothing is flagged primary', () => {
    const out = orderedImages([
      { url: 'c.jpg', order: 2 },
      { url: 'a.jpg', order: 0 },
      { url: 'b.jpg', order: 1 },
    ]);
    expect(out.map((i) => i.url)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
  });

  it('keeps array order for entries with no order field', () => {
    const out = orderedImages([{ url: 'x.jpg' }, { url: 'y.jpg' }]);
    expect(out.map((i) => i.url)).toEqual(['x.jpg', 'y.jpg']);
  });

  it('accepts legacy plain-string images and trims them', () => {
    expect(orderedImages([' legacy.jpg '])).toEqual([{ url: 'legacy.jpg' }]);
  });
});

describe('inheritedProductImages', () => {
  it('returns the parent product images in display order', () => {
    const sp = {
      product: {
        images: [
          { url: 'p1.jpg', order: 1 },
          { url: 'p2.jpg', order: 0, isPrimary: true },
        ],
      },
    };
    expect(inheritedProductImages(sp.product).map((i) => i.url)).toEqual([
      'p2.jpg',
      'p1.jpg',
    ]);
  });

  it('returns an empty list when the parent product carries no images', () => {
    // 428 of 964 live sub-products are in exactly this state: the parent
    // product's `images` array is empty, so there is nothing to inherit.
    expect(inheritedProductImages({ name: 'Krug', images: [] })).toEqual([]);
    expect(inheritedProductImages(undefined)).toEqual([]);
  });
});

describe('resolveSubProductImage', () => {
  it('prefers the sub-product override over the parent product image', () => {
    const sp = {
      imagesOverride: [{ url: 'own.jpg' }],
      product: { images: [{ url: 'parent.jpg' }] },
    };
    expect(resolveSubProductImage(sp)).toBe('own.jpg');
  });

  it('falls back to the parent product image when there is no override', () => {
    const sp = {
      imagesOverride: [],
      product: { images: [{ url: 'parent.jpg' }] },
    };
    expect(resolveSubProductImage(sp)).toBe('parent.jpg');
  });

  it('is undefined when neither side has an image', () => {
    expect(resolveSubProductImage({ product: { images: [] } })).toBeUndefined();
  });
});

describe('resolveSubProductImages', () => {
  it('lists the override first, then the parent image, as load-error fallbacks', () => {
    const sp = {
      imagesOverride: [{ url: 'own.jpg' }],
      product: { images: [{ url: 'parent.jpg' }] },
    };
    expect(resolveSubProductImages(sp)).toEqual(['own.jpg', 'parent.jpg']);
  });

  it('de-duplicates when the override repeats the parent image', () => {
    const sp = {
      imagesOverride: [{ url: 'same.jpg' }],
      product: { images: [{ url: 'same.jpg' }] },
    };
    expect(resolveSubProductImages(sp)).toEqual(['same.jpg']);
  });
});

describe('resolveSubProductGallery', () => {
  it('returns every parent image in display order when there is no override', () => {
    const sp = {
      product: {
        images: [
          { url: 'p1.jpg' },
          { url: 'p2.jpg', isPrimary: true },
          { url: 'p3.jpg' },
        ],
      },
    };
    expect(resolveSubProductGallery(sp).map((i) => i.url)).toEqual([
      'p2.jpg',
      'p1.jpg',
      'p3.jpg',
    ]);
  });

  it('replaces the parent gallery entirely once the sub-product has its own', () => {
    // `imagesOverride` is an override, not an addition — a tenant that uploads
    // its own shot should not still show the platform product's photos.
    const sp = {
      imagesOverride: [{ url: 'own1.jpg' }, { url: 'own2.jpg' }],
      product: { images: [{ url: 'parent.jpg' }] },
    };
    expect(resolveSubProductGallery(sp).map((i) => i.url)).toEqual([
      'own1.jpg',
      'own2.jpg',
    ]);
  });

  it('is empty when neither side has an image', () => {
    expect(resolveSubProductGallery({ product: { images: [] } })).toEqual([]);
  });
});

describe('resolveSubProductThumb', () => {
  it('prefers the stored Cloudinary thumbnail over the full-size url', () => {
    const sp = {
      product: { images: [{ url: 'big.jpg', thumbnail: 'small.jpg' }] },
    };
    expect(resolveSubProductThumb(sp)).toBe('small.jpg');
  });

  it('uses the url when no thumbnail was generated', () => {
    const sp = { product: { images: [{ url: 'big.jpg' }] } };
    expect(resolveSubProductThumb(sp)).toBe('big.jpg');
  });

  it('takes the override thumbnail ahead of the parent image', () => {
    const sp = {
      imagesOverride: [{ url: 'own.jpg', thumbnail: 'own-thumb.jpg' }],
      product: {
        images: [{ url: 'parent.jpg', thumbnail: 'parent-thumb.jpg' }],
      },
    };
    expect(resolveSubProductThumb(sp)).toBe('own-thumb.jpg');
  });

  it('respects the primary flag rather than taking images[0]', () => {
    const sp = {
      product: {
        images: [{ url: 'first.jpg' }, { url: 'hero.jpg', isPrimary: true }],
      },
    };
    expect(resolveSubProductThumb(sp)).toBe('hero.jpg');
  });

  it('is undefined when there is nothing to show', () => {
    expect(resolveSubProductThumb({})).toBeUndefined();
  });
});
