// Which `src` string the POS grid hands to an <img>, and whether the cashier is
// looking at bytes we hold or at a URL that needs a network.
//
// This module degrades to a plausible wrong result rather than to an error: a
// broken image, an image whose bytes were never cached, and a product that
// genuinely has no image all render as the same blank tile. So the resolver
// reports three states, and the tests below assert that a product WITH an image
// and a product WITHOUT one reach DIFFERENT outcomes offline — otherwise a
// uniformly broken cache is indistinguishable from a working one.
//
// See docs/superpowers/specs/2026-08-17-pos-offline-product-images-design.md.

import { describe, expect, test } from 'vitest';
import {
  catalogueImageKeys,
  posThumbUrl,
  resolveImageSource,
} from './image-cache';

// Real URL shapes, copied from Atlas — 530 of Wyn City's 956 active
// sub-products carry one of these, and none of them store a `.thumbnail`.
const JPG =
  'https://res.cloudinary.com/ds1sacenk/image/upload/v1783601019/drinksharbour/products/gallery/ofumhhily5ckbrwffndx.jpg';
const JPG_W300 =
  'https://res.cloudinary.com/ds1sacenk/image/upload/f_auto,q_auto,w_300/v1783601019/drinksharbour/products/gallery/ofumhhily5ckbrwffndx.jpg';
const WEBP =
  'https://res.cloudinary.com/ds1sacenk/image/upload/v1785448713/drinksharbour/products/gallery/lwnbrkgof3tjo0hpcsku.webp';
const WEBP_W300 =
  'https://res.cloudinary.com/ds1sacenk/image/upload/f_auto,q_auto,w_300/v1785448713/drinksharbour/products/gallery/lwnbrkgof3tjo0hpcsku.webp';

/** A sub-product as the POS receives it: images inherited from the parent. */
function withImage(url: string) {
  return {
    _id: 'sp1',
    product: { _id: 'p1', name: 'Jack Daniels', images: [{ url }] },
  };
}
/** One of the 426 sub-products whose parent Product has `images: []`. */
function withoutImage() {
  return {
    _id: 'sp2',
    product: { _id: 'p2', name: 'Unphotographed', images: [] },
  };
}

describe('posThumbUrl', () => {
  test('asks Cloudinary for a w_300 derivative instead of the full original', () => {
    // Measured: this original is 101,729 B; the w_300 derivative is 10,595 B.
    expect(posThumbUrl(JPG)).toBe(JPG_W300);
  });

  test('transforms a .webp the same way as a .jpg', () => {
    expect(posThumbUrl(WEBP)).toBe(WEBP_W300);
  });

  test('honours an explicit width', () => {
    expect(posThumbUrl(JPG, 200)).toBe(
      'https://res.cloudinary.com/ds1sacenk/image/upload/f_auto,q_auto,w_200/v1783601019/drinksharbour/products/gallery/ofumhhily5ckbrwffndx.jpg'
    );
  });

  test('is idempotent — it does not stack a second transformation', () => {
    // The cache key is derived from this string. If it were not idempotent the
    // same image would occupy two keys and be downloaded twice.
    expect(posThumbUrl(JPG_W300)).toBe(JPG_W300);
  });

  test('leaves a URL that already carries some other transformation alone', () => {
    const cropped =
      'https://res.cloudinary.com/ds1sacenk/image/upload/c_fill,h_400,w_400/v1783601019/drinksharbour/x.jpg';
    expect(posThumbUrl(cropped)).toBe(cropped);
  });

  test('inserts the transformation when the URL carries no version segment', () => {
    expect(
      posThumbUrl(
        'https://res.cloudinary.com/ds1sacenk/image/upload/drinksharbour/x.jpg'
      )
    ).toBe(
      'https://res.cloudinary.com/ds1sacenk/image/upload/f_auto,q_auto,w_300/drinksharbour/x.jpg'
    );
  });

  test('returns a non-Cloudinary URL untouched', () => {
    // Never rewrite a host whose transformation grammar we do not know.
    expect(posThumbUrl('https://example.com/photos/bottle.png')).toBe(
      'https://example.com/photos/bottle.png'
    );
  });

  test('returns an unparseable value untouched rather than throwing', () => {
    expect(posThumbUrl('not a url')).toBe('not a url');
  });
});

describe('resolveImageSource', () => {
  test('a product with an image and a product without reach DIFFERENT outcomes when nothing is cached', () => {
    // The whole point. If both collapsed to one state, a wholly broken cache
    // would look exactly like a catalogue of unphotographed products.
    const empty = new Map<string, string>();

    expect(resolveImageSource(withImage(JPG), empty)).toEqual({
      kind: 'remote',
      src: JPG_W300,
      key: JPG_W300,
    });
    expect(resolveImageSource(withoutImage(), empty)).toEqual({
      kind: 'missing',
      src: null,
      key: null,
    });
  });

  test('serves the blob object URL once the bytes are cached', () => {
    const cached = new Map([[JPG_W300, 'blob:http://localhost/abc-123']]);

    expect(resolveImageSource(withImage(JPG), cached)).toEqual({
      kind: 'cached',
      src: 'blob:http://localhost/abc-123',
      key: JPG_W300,
    });
  });

  test('a product without an image stays `missing` even when the cache is full', () => {
    // A populated cache must not conjure a src for a product that has none.
    const cached = new Map([[JPG_W300, 'blob:http://localhost/abc-123']]);

    expect(resolveImageSource(withoutImage(), cached)).toEqual({
      kind: 'missing',
      src: null,
      key: null,
    });
  });

  test('keys the cache on the w_300 URL, so a cached original is still a miss', () => {
    // Storing the 107 KB original under its own URL must not satisfy a tile
    // that asks for the 10.6 KB derivative — otherwise the terminal would
    // silently keep the heavy version.
    const wrongKey = new Map([[JPG, 'blob:http://localhost/original']]);

    expect(resolveImageSource(withImage(JPG), wrongKey)).toEqual({
      kind: 'remote',
      src: JPG_W300,
      key: JPG_W300,
    });
  });

  test("prefers the sub-product's own override over the inherited parent image", () => {
    // `imagesOverride` is an override, not an addition — resolveSubProductGallery
    // already owns that rule; this pins that the cache key follows it.
    const sp = {
      _id: 'sp3',
      imagesOverride: [{ url: WEBP }],
      product: { _id: 'p3', name: 'Overridden', images: [{ url: JPG }] },
    };

    expect(resolveImageSource(sp, new Map())).toEqual({
      kind: 'remote',
      src: WEBP_W300,
      key: WEBP_W300,
    });
  });

  test('treats a product with no parent product at all as missing', () => {
    expect(resolveImageSource({ _id: 'sp4' }, new Map())).toEqual({
      kind: 'missing',
      src: null,
      key: null,
    });
  });
});

describe('catalogueImageKeys', () => {
  test('asks for the w_300 derivative of every product that has an image', () => {
    expect(catalogueImageKeys([withImage(JPG), withImage(WEBP)])).toEqual([
      JPG_W300,
      WEBP_W300,
    ]);
  });

  test('skips products with no image rather than queueing a key that cannot exist', () => {
    // 426 of Wyn City's 956 sub-products are in this state. Precaching a null
    // key would report failures forever for a data gap that is not ours.
    expect(
      catalogueImageKeys([withImage(JPG), withoutImage(), { _id: 'x' }])
    ).toEqual([JPG_W300]);
  });

  test('emits a shared image once, however many products inherit it', () => {
    // Sub-products inherit the parent Product's photo, so two tenants' rows for
    // the same bottle are one download.
    expect(catalogueImageKeys([withImage(JPG), withImage(JPG)])).toEqual([
      JPG_W300,
    ]);
  });

  test('is empty for an empty catalogue', () => {
    expect(catalogueImageKeys([])).toEqual([]);
  });
});
