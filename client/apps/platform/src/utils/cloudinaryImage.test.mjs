import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudinaryImageLoader, canOptimizeCloudinary } from './cloudinaryImage.ts';
const src = 'https://res.cloudinary.com/drinks/image/upload/v123/products/bottle.jpg';
test('Cloudinary delivers viewport-sized auto-format and auto-quality image', () => {
  assert.equal(cloudinaryImageLoader({ src, width: 384 }), 'https://res.cloudinary.com/drinks/image/upload/f_auto,q_auto,c_limit,w_384/v123/products/bottle.jpg');
});
test('preserves existing crop, version and public folder', () => {
  assert.equal(cloudinaryImageLoader({ src: src.replace('upload/', 'upload/c_crop,h_900/'), width: 640, quality: 80 }), 'https://res.cloudinary.com/drinks/image/upload/c_crop,h_900/f_auto,q_80,c_limit,w_640/v123/products/bottle.jpg');
});
test('signed, animated, vector, query-authenticated and other-host images retain native loading', () => {
  for (const url of [src.replace('/v123/', '/s--signed--/v123/'), src.replace('.jpg', '.gif'), src.replace('.jpg', '.svg'), src + '?__cld_token__=token', '/images/logo.png', src.replace('res.cloudinary.com', 'example.com'), src.replace('/v123/', '/')]) {
    assert.equal(canOptimizeCloudinary(url), false, url);
  }
});
