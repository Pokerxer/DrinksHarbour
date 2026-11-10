// __tests__/transientRescue.http.test.js
//
// The rule this file exists to protect: the crawler-hot PUBLIC reads
// (/api/brands/slug/:slug, /api/products/slug/:slug, /api/products/search) must
// survive the transient Atlas blip that already has proven rescue semantics
// (utils/db-retry.js). Before this, the ERM controllers had withDbRetry and the
// public catalog routes did not, so the same transient event looked like a
// broken endpoint (500) exactly when crawler bursts landed — 2026-11-10.

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const brandService = require('../services/brand.service');
const productService = require('../services/product.service');
const brandController = require('../controllers/brand.controller');
const productController = require('../controllers/product.controller');

// Mini app mirroring server.js's error-handler contract: no statusCode → 500.
// The 503 mapping itself is covered in dbErrorHttp.test.js; here the assertion
// is that NO error reaches the handler at all when the rescue works.
function miniApp(mount) {
  const app = express();
  mount(app);
  app.use((err, _req, res, _next) =>
    res.status(err.statusCode || err.status || 500).json({ success: false })
  );
  return app;
}

async function serve(mount) {
  const server = await new Promise((resolve) => {
    const s = miniApp(mount).listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

const networkBlip = () => {
  const e = new Error('tlsv1 alert internal error:SSL alert number 80');
  e.name = 'MongoNetworkError';
  return e;
};

test('GET /api/brands/slug/:slug rescues one MongoNetworkError and serves the brand', async () => {
  const attempts = [];
  const original = brandService.getBrandBySlug;
  brandService.getBrandBySlug = async (slug) => {
    attempts.push(slug);
    if (attempts.length === 1) throw networkBlip();
    return { slug };
  };

  const { base, close } = await serve((app) =>
    app.get('/:slug', brandController.getBrandBySlug)
  );
  try {
    const res = await fetch(`${base}/johnnie-walker`);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).data, { brand: { slug: 'johnnie-walker' } });
    assert.equal(attempts.length, 2, 'must retry once and recover');
  } finally {
    brandService.getBrandBySlug = original;
    await close();
  }
});

test('GET /api/products/slug/:slug rescues one MongoNetworkError and serves the product', async () => {
  const attempts = [];
  const original = productService.getProductBySlug;
  productService.getProductBySlug = async (slug) => {
    attempts.push(slug);
    if (attempts.length === 1) throw networkBlip();
    return { slug };
  };

  const { base, close } = await serve((app) =>
    app.get('/:slug', productController.getProductBySlug)
  );
  try {
    const res = await fetch(`${base}/johnnie-walker-reserve`);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).data, { product: { slug: 'johnnie-walker-reserve' } });
    assert.equal(attempts.length, 2, 'must retry once and recover');
  } finally {
    productService.getProductBySlug = original;
    await close();
  }
});

test('GET /api/products/search (public) rescues one MongoNetworkError', async () => {
  const attempts = [];
  const original = productService.searchProducts;
  productService.searchProducts = async (params) => {
    attempts.push(params);
    if (attempts.length === 1) throw networkBlip();
    return { products: [] };
  };

  const { base, close } = await serve((app) =>
    app.get('/search', productController.searchProductsPublic)
  );
  try {
    const res = await fetch(`${base}/search?brand=13%20Secrets&limit=8`);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).data, { products: [] });
    assert.equal(attempts.length, 2, 'must retry once and recover');
    assert.equal(attempts[0].brand === undefined || Array.isArray(attempts[0].brand), true,
      'public search forwards the brand filter, normalized');
    assert.deepEqual(attempts[0].brand, ['13 Secrets']);
  } finally {
    productService.searchProducts = original;
    await close();
  }
});

test('GET /api/products/search rescues one MongoNetworkError', async () => {
  const calls = [];
  const original = productService.searchProducts;
  productService.searchProducts = async (params) => {
    calls.push(params);
    if (calls.length === 1) throw networkBlip();
    return { products: [{ slug: 'balvenie-12' }] };
  };

  const { base, close } = await serve((app) =>
    app.get('/search', productController.searchProducts)
  );
  try {
    const res = await fetch(`${base}/search?brand=Balvenie&limit=8`);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).data.products, [{ slug: 'balvenie-12' }]);
    assert.equal(calls.length, 2, 'must retry once and recover');
    assert.deepEqual(calls[0].brand, ['Balvenie']);
  } finally {
    productService.searchProducts = original;
    await close();
  }
});

test('a NON-transient failure is not retried and surfaces unchanged', async () => {
  const attempts = [];
  const original = brandService.getBrandBySlug;
  brandService.getBrandBySlug = async (slug) => {
    attempts.push(slug);
    const e = new Error('E11000 duplicate key error');
    e.name = 'MongoServerError';
    e.code = 11000;
    throw e;
  };

  const { base, close } = await serve((app) =>
    app.get('/:slug', brandController.getBrandBySlug)
  );
  try {
    const res = await fetch(`${base}/dup`);
    assert.equal(res.status, 500);
    assert.equal(attempts.length, 1, 'dup key must never re-execute');
  } finally {
    brandService.getBrandBySlug = original;
    await close();
  }
});
