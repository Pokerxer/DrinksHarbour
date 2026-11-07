import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBrands } from './loadBrands.ts';

const brand = (id, extra = {}) => ({ _id: id, name: `House ${id}`, slug: `house-${id}`, ...extra });
const response = (brands, pagination = { page: 1, pages: 1, total: brands.length }) =>
  Response.json({ success: true, data: { brands, pagination } });

test('loads every advertised page, deduplicates IDs and keeps compact zero-count cards', async () => {
  const urls = [];
  const cards = await loadBrands({ apiUrl: 'https://api.example.com/', fetcher: async url => {
    urls.push(new URL(url));
    return urls.length === 1
      ? response([brand('1', { productCount: 0, description: 'Story '.repeat(300) })], { page: 1, pages: 2, total: 3 })
      : response([brand('1'), brand('2')], { page: 2, pages: 2, total: 3 });
  } });
  assert.deepEqual(cards.map(card => card._id), ['1', '2']);
  assert.equal(cards[0].productCount, 0);
  assert.ok(cards[0].shortDescription.length <= 240);
  assert.equal('description' in cards[0], false);
  assert.deepEqual(urls.map(url => url.searchParams.get('page')), ['1', '2']);
  assert.equal(urls[0].pathname, '/api/brands');
  assert.equal(urls[0].searchParams.get('status'), 'active');
  assert.equal(urls[0].searchParams.get('limit'), '500');
});

test('passes literal search and country to backend without narrowing alias results locally', async () => {
  let requestUrl;
  const cards = await loadBrands({ apiUrl: 'https://api.example.com', search: ' Alias & Co+ ', country: 'Trinidad & Tobago',
    fetcher: async url => { requestUrl = new URL(url); return response([brand('1', { name: 'Different legal name' })]); },
  });
  assert.equal(requestUrl.searchParams.get('search'), 'Alias & Co+');
  assert.equal(requestUrl.searchParams.get('country'), 'Trinidad & Tobago');
  assert.equal(requestUrl.searchParams.get('status'), 'active');
  assert.equal(cards[0].name, 'Different legal name');
});

test('supports totalPages metadata and rejects losing a later page', async () => {
  let calls = 0;
  await assert.rejects(loadBrands({ apiUrl: 'https://api.example.com', fetcher: async () => {
    calls += 1;
    return calls === 1
      ? response([brand('1')], { page: 1, totalPages: 2, total: 2 })
      : Response.json({ message: 'Unavailable' }, { status: 503 });
  } }), /load brands/i);
  assert.equal(calls, 2);
});

test('returns a successful empty directory', async () => {
  assert.deepEqual(await loadBrands({ apiUrl: 'https://api.example.com', fetcher: async () =>
    response([], { page: 1, pages: 0, total: 0 }) }), []);
});

test('rejects malformed and unsuccessful payloads instead of showing a false empty state', async () => {
  for (const payload of [{ success: false }, { success: true, data: {} },
    { success: true, data: { brands: [], pagination: { pages: 2, total: 2 } } }]) {
    await assert.rejects(loadBrands({ apiUrl: 'https://api.example.com', fetcher: async () => Response.json(payload) }));
  }
});

test('rejects an empty later page when metadata still promises records', async () => {
  let calls = 0;
  await assert.rejects(loadBrands({ apiUrl: 'https://api.example.com', fetcher: async () => {
    calls += 1;
    return response(calls === 1 ? [brand('1')] : [], { page: calls, pages: 2, total: 2 });
  } }));
});

test('omits invalid destinations without hiding missing product counts', async () => {
  const cards = await loadBrands({ apiUrl: 'https://api.example.com', fetcher: async () =>
    response([brand('1'), { _id: '2', name: 'Incomplete' }]) });
  assert.deepEqual(cards.map(card => card._id), ['1']);
});

test('forwards cancellation and rejects even if a transport ignores abort', async () => {
  const controller = new AbortController();
  let receivedSignal;
  await assert.rejects(loadBrands({ apiUrl: 'https://api.example.com', signal: controller.signal,
    fetcher: async (_url, options) => {
      receivedSignal = options.signal;
      controller.abort();
      return response([brand('1')]);
    },
  }), { name: 'AbortError' });
  assert.equal(receivedSignal, controller.signal);
});

test('already aborted requests never hit the network', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadBrands({ apiUrl: 'https://api.example.com', signal: controller.signal,
    fetcher: async () => assert.fail('aborted request reached transport'),
  }), { name: 'AbortError' });
});

test('uses fresh client requests and explicitly configured server revalidation', async () => {
  const options = [];
  const fetcher = async (_url, init) => { options.push(init); return response([]); };
  await loadBrands({ apiUrl: 'https://api.example.com', fetcher });
  await loadBrands({ apiUrl: 'https://api.example.com', fetcher, revalidate: 3600 });
  assert.equal(options[0].cache, 'no-store');
  assert.deepEqual(options[1].next, { revalidate: 3600 });
  assert.equal(options[1].cache, undefined);
});
