import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFlashSaleProducts } from './flash-sale-data.ts';

test('flash sales make one bounded fresh card request despite many catalog pages', async () => {
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url, options) => {
    urls.push(new URL(url));
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => ({ success: true, data: { products: [{ _id: 'sale' }], pagination: { totalPages: 900 } } }) };
  };
  try {
    assert.deepEqual(await fetchFlashSaleProducts('https://api.test'), [{ _id: 'sale' }]);
    assert.equal(urls.length, 1);
    assert.equal(urls[0].searchParams.get('saleType'), 'flash_sale');
    assert.equal(urls[0].searchParams.get('limit'), '20');
    assert.equal(urls[0].searchParams.get('fields'), 'card');
  } finally { globalThis.fetch = original; }
});
test('overlapping requests share work but the next request reads fresh prices', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  let release;
  globalThis.fetch = () => {
    calls++;
    return new Promise(resolve => { release = () => resolve({ ok: true, json: async () => ({ products: [] }) }); });
  };
  try {
    const first = fetchFlashSaleProducts('https://api.test');
    const second = fetchFlashSaleProducts('https://api.test');
    assert.equal(calls, 1);
    release();
    await Promise.all([first, second]);
    const next = fetchFlashSaleProducts('https://api.test');
    assert.equal(calls, 2);
    release();
    await next;
  } finally { globalThis.fetch = original; }
});
test('failed requests can be retried', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ products: [] }) };
  try {
    await assert.rejects(fetchFlashSaleProducts('https://api.test'), /503/);
    assert.deepEqual(await fetchFlashSaleProducts('https://api.test'), []);
    assert.equal(calls, 2);
  }
  finally { globalThis.fetch = original; }
});
