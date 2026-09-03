// When a customer asks to SEE a drink, the bot answers with the picture the
// shop already has on file.
//
// The model emits an `IMAGE_JSON: ["<name>"]` marker line (same machinery as
// CART_JSON); the server resolves those names against the products it already
// found for this turn and returns the SAVED image URLs. The model never emits a
// URL — the catalogue text it reads contains none, so anything URL-shaped in
// its output is a hallucination pointed at an arbitrary host.
//
// The trap this file mostly exists to pin: three different image shapes reach
// the resolver — a flat `image` string (catalog entries), `images[]` of `{url}`
// objects, and `images[]` of bare strings. A resolver that only reads
// `images[0].url` returns nothing for half the catalogue.

const test = require('node:test');
const assert = require('node:assert/strict');

const { extractProductImages, extractCartProposal } = require('../services/chatbot.service');

const OBJECT_SHAPE = {
  name: 'Moet Chandon Brut',
  slug: 'moet-chandon-brut',
  minPrice: 95000,
  images: [{ url: 'https://cdn.example.com/moet.jpg' }, { url: 'https://cdn.example.com/moet-2.jpg' }],
};
const STRING_SHAPE = {
  name: 'Jack Daniels Old No 7',
  slug: 'jack-daniels-old-no-7',
  minPrice: 42000,
  images: ['https://cdn.example.com/jack.jpg'],
};
const CATALOG_ENTRY_SHAPE = {
  name: 'Hennessy VS',
  slug: 'hennessy-vs',
  minPrice: 68000,
  image: 'https://cdn.example.com/hennessy.jpg',
};
const NO_IMAGE = {
  name: 'Nameless Gin',
  slug: 'nameless-gin',
  minPrice: 15000,
  images: [],
};

const CATALOG = [OBJECT_SHAPE, STRING_SHAPE, CATALOG_ENTRY_SHAPE, NO_IMAGE];

test('a reply with no IMAGE_JSON line is returned unchanged, with no images', () => {
  const reply = 'Hennessy VS is a lovely cognac — smooth, with a warm oak finish.';
  const { text, images } = extractProductImages(reply, CATALOG);

  assert.equal(text, reply);
  assert.deepEqual(images, []);
});

test('the IMAGE_JSON line is stripped from the display text', () => {
  const reply = `Here it is! 🥃\n\nIMAGE_JSON: ["Hennessy VS"]`;
  const { text, images } = extractProductImages(reply, CATALOG);

  assert.equal(text, 'Here it is! 🥃');
  assert.ok(!text.includes('IMAGE_JSON'), 'the marker must never reach the customer');
  assert.deepEqual(images, ['https://cdn.example.com/hennessy.jpg']);
});

test('a code fence left orphaned by the strip is cleaned up', () => {
  const reply = 'Here it is! 🥃\n\n```json\nIMAGE_JSON: ["Hennessy VS"]\n```';
  const { text } = extractProductImages(reply, CATALOG);

  assert.equal(text, 'Here it is! 🥃');
});

test('malformed IMAGE_JSON degrades to no images and never throws', () => {
  const reply = 'Here it is!\n\nIMAGE_JSON: ["Hennessy VS", ]';
  const { text, images } = extractProductImages(reply, CATALOG);

  assert.equal(text, 'Here it is!');
  assert.deepEqual(images, []);
});

test('a name that matches nothing in the catalogue yields no image', () => {
  const reply = 'Here it is!\n\nIMAGE_JSON: ["Chateau Imaginaire 1961"]';
  const { images } = extractProductImages(reply, CATALOG);

  assert.deepEqual(images, [], 'an unresolved name must not become a broken <img>');
});

test('a URL emitted by the model is never trusted', () => {
  const reply = 'Here it is!\n\nIMAGE_JSON: ["https://evil.example.com/whatever.jpg"]';
  const { images } = extractProductImages(reply, CATALOG);

  assert.deepEqual(images, []);
});

test('a product whose only image is a bare string still resolves', () => {
  const reply = 'Here you go!\n\nIMAGE_JSON: ["Jack Daniels Old No 7"]';
  const { images } = extractProductImages(reply, CATALOG);

  assert.deepEqual(images, ['https://cdn.example.com/jack.jpg']);
});

test('a product whose images are {url} objects resolves to the first url', () => {
  const reply = 'Here you go!\n\nIMAGE_JSON: ["Moet Chandon Brut"]';
  const { images } = extractProductImages(reply, CATALOG);

  assert.deepEqual(images, ['https://cdn.example.com/moet.jpg']);
});

test('a product with no image at all is skipped, not returned as null', () => {
  const reply = 'Here you go!\n\nIMAGE_JSON: ["Nameless Gin"]';
  const { images } = extractProductImages(reply, CATALOG);

  assert.deepEqual(images, []);
});

test('a partial name resolves the same way the cart proposal does', () => {
  const reply = 'Here you go!\n\nIMAGE_JSON: ["Hennessy"]';
  const { images } = extractProductImages(reply, CATALOG);

  assert.deepEqual(images, ['https://cdn.example.com/hennessy.jpg']);
});

test('the same product named twice yields one image', () => {
  const reply = 'Here you go!\n\nIMAGE_JSON: ["Hennessy VS", "Hennessy"]';
  const { images } = extractProductImages(reply, CATALOG);

  assert.deepEqual(images, ['https://cdn.example.com/hennessy.jpg']);
});

test('the cap holds — a wall of bottle shots is never returned', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    name: `Product ${i}`,
    slug: `product-${i}`,
    images: [`https://cdn.example.com/${i}.jpg`],
  }));
  const names = many.map(p => p.name);
  const reply = `Here they are!\n\nIMAGE_JSON: ${JSON.stringify(names)}`;
  const { images } = extractProductImages(reply, many);

  assert.equal(images.length, 4);
  assert.deepEqual(images, [
    'https://cdn.example.com/0.jpg',
    'https://cdn.example.com/1.jpg',
    'https://cdn.example.com/2.jpg',
    'https://cdn.example.com/3.jpg',
  ]);
});

// The service calls extractCartProposal first and then feeds the stripped text
// to extractProductImages — this is that pipeline, in order.
test('CART_JSON and IMAGE_JSON in the same reply both parse and both are stripped', () => {
  const reply = [
    'Here it is! Want me to add it to your cart? 🛒',
    '',
    'IMAGE_JSON: ["Hennessy VS"]',
    'CART_JSON: [{"name":"Hennessy VS","size":"70cl","qty":2}]',
  ].join('\n');

  const { text: afterCart, proposal } = extractCartProposal(reply, CATALOG);
  const { text, images } = extractProductImages(afterCart, CATALOG);

  assert.equal(text, 'Here it is! Want me to add it to your cart? 🛒');
  assert.ok(!text.includes('CART_JSON'));
  assert.ok(!text.includes('IMAGE_JSON'));
  assert.equal(proposal.length, 1);
  assert.equal(proposal[0].qty, 2);
  assert.deepEqual(images, ['https://cdn.example.com/hennessy.jpg']);
});

test('a non-array IMAGE_JSON payload is ignored', () => {
  const reply = 'Here it is!\n\nIMAGE_JSON: ["Hennessy VS"]'.replace('["Hennessy VS"]', '[]');
  const { images } = extractProductImages(reply, CATALOG);

  assert.deepEqual(images, []);
});

test('an empty or missing reply is handled', () => {
  assert.deepEqual(extractProductImages('', CATALOG), { text: '', images: [] });
  assert.deepEqual(extractProductImages(null, CATALOG), { text: null, images: [] });
});
