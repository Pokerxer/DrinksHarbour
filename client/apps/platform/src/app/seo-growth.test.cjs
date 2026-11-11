const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

process.env.NEXT_PUBLIC_API_URL = 'https://api.example.test';
const root = path.resolve(__dirname, '..');
function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (path.extname(filename) === '.json') return JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (path.extname(filename) === '.css') return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
  if (cache.has(filename)) return cache.get(filename).exports;
  const fixture = new Module(filename, module);
  cache.set(filename, fixture);
  fixture.paths = module.paths;
  fixture.require = request => {
    if (request in mocks) return mocks[request];
    if (request === '@/app/fonts') return { fraunces: { className: 'test-display-font' } };
    if (request === '@/context/AuthContext') return { useAuth: () => ({ isAuthenticated: false, isLoading: false, user: null }) };
      if (request === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (request === 'next/navigation') return { notFound() { throw new Error('NOT_FOUND'); } };
    if (request.startsWith('@/') || request.startsWith('.')) {
      const base = request.startsWith('@/') ? path.join(root, request.slice(2)) : path.resolve(path.dirname(filename), request);
      const target = [base, base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (target) return load(path.relative(root, target), mocks, cache);
    }
    return require(request);
  };
  fixture._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return fixture.exports;
}

test('canonical category guides resolve aliases but reject invented or compound categories', () => {
  const { getCategoryBuyingGuide } = load('lib/categoryBuyingGuide.ts');
  assert.equal(getCategoryBuyingGuide('scotch-whisky').slug, 'scotch');
  assert.equal(getCategoryBuyingGuide('wines').slug, 'wine');
  assert.equal(getCategoryBuyingGuide('GIN').slug, 'gin');
  assert.equal(getCategoryBuyingGuide('gin,rum'), undefined);
  assert.equal(getCategoryBuyingGuide('invented-bottles'), undefined);
});

test('category-only buying context is suppressed for combined filters and later pages', () => {
  const { categoryGuideForParams } = load('lib/categoryBuyingGuide.ts');
  assert.equal(categoryGuideForParams({ category: 'gin' }).slug, 'gin');
  assert.equal(categoryGuideForParams({ category: 'gin', page: '1' }).slug, 'gin');
  for (const extra of [{ page: '2' }, { brand: 'Test' }, { subcategory: 'pink' }, { origin: 'UK' }, { search: 'pink' }, { sale: 'true' }, { minPrice: '2000' }]) {
    assert.equal(categoryGuideForParams({ category: 'gin', ...extra }), undefined);
  }
});

const shopMocks = {
  './ShopClient': { __esModule: true, default: () => null },
  '@/components/Shop/recommendations': { fetchInitialRecommendations: async () => [] },
};

test('canonical shop has visible category advice with unique metadata without claiming fast delivery everywhere', async () => {
  const original = global.fetch;
  global.fetch = async url => ({ ok: true, json: async () => url.includes('/api/categories')
    ? { data: { categories: [{ name: 'Gin', slug: 'gin', productCount: 12 }, { name: 'Tequila', slug: 'tequila', productCount: 8 }] } }
    : { data: { products: [], total: 0 } } });
  try {
    const shop = load('app/shop/page.tsx', shopMocks);
    const gin = await shop.generateMetadata({ searchParams: Promise.resolve({ category: 'gin' }) });
    const tequila = await shop.generateMetadata({ searchParams: Promise.resolve({ category: 'tequila' }) });
    assert.notEqual(gin.description, tequila.description);
    assert(!/fast delivery across all 36/i.test(gin.description));
    assert(String(gin.alternates.canonical).endsWith('/shop?category=gin'));
    const html = renderToStaticMarkup(await shop.default({ searchParams: Promise.resolve({ category: 'gin' }) }));
    assert.match(html, /Choosing your gin/i);
    assert.match(html, /href="\/authenticity-guarantee"/);
    assert.match(html, /href="\/delivery\/lagos"/);
    const filtered = renderToStaticMarkup(await shop.default({ searchParams: Promise.resolve({ category: 'gin', brand: 'Test' }) }));
    assert(!/Choosing your gin/i.test(filtered));
  } finally { global.fetch = original; }
});

test('product buying content is the same for shoppers and crawlers, and 0% ABV survives schema', async () => {
  const original = global.fetch;
  const product = { _id: 'p1', slug: 'test-alcohol-free', name: 'Test Alcohol Free', abv: 0, originCountry: 'Nigeria', averageRating: 0, reviewCount: 0, availableAt: [] };
  global.fetch = async () => ({ ok: true, json: async () => ({ data: { product } }) });
  const htmlFor = async crawler => {
    const page = load('app/product/[slug]/page.tsx', {
      'commerce-core': {
        ...load('../../../packages/commerce-core/src/default-variant.ts'),
        ...load('../../../packages/commerce-core/src/commerce-policy.ts'),
      },
      './ProductClient': { __esModule: true, default: () => null },
      '@/components/Banner/product-page-banner-data': { fetchProductBannerSeed: async () => ({}) },
      '@/lib/crawlerRequest': { isCrawlerRequest: async () => crawler },
    });
    return renderToStaticMarkup(await page.default({ params: Promise.resolve({ slug: product.slug }) }));
  };
  try {
    const shopperHtml = await htmlFor(false);
    const crawlerHtml = await htmlFor(true);
    assert.equal(shopperHtml, crawlerHtml);
    assert.match(shopperHtml, /About this bottle/);
    assert.match(shopperHtml, /Questions about Test Alcohol Free/);
    assert.match(shopperHtml, /0%/);
    const schemas = [...shopperHtml.matchAll(/<script[^>]*>(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    const schema = schemas.find(item => item['@type'] === 'Product');
    assert(schema.additionalProperty.some(item => item.name === 'ABV' && item.value === '0%'));
    assert.equal(schema.aggregateRating, undefined);
    assert.equal(schema.review, undefined);
    assert(!shopperHtml.includes('FAQPage'), 'FAQ rich results are retired; visible questions are sufficient');
  } finally { global.fetch = original; }
});

test('occasion routes reject unknown occasions and give each supported intent a canonical, useful page', async () => {
  const route = load('app/occasions/[occasion]/page.tsx');
  await assert.rejects(() => route.default({ params: Promise.resolve({ occasion: 'imaginary-event' }) }), /NOT_FOUND/);
  const descriptions = new Set();
  for (const occasion of ['weddings', 'corporate', 'house-parties', 'gifting']) {
    const meta = await route.generateMetadata({ params: Promise.resolve({ occasion }) });
    assert(String(meta.alternates.canonical).endsWith('/occasions/' + occasion));
    descriptions.add(meta.description);
    const html = renderToStaticMarkup(await route.default({ params: Promise.resolve({ occasion }) }));
    assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
    assert.match(html, /href="https:\/\/wa.me\//);
    assert.match(html, /href="\/shipping-info"/);
    assert.match(html, /href="\/shop\?category=/);
    const schemas = [...html.matchAll(/<script[^>]*>(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    assert(schemas.some(schema => schema['@type'] === 'BreadcrumbList'));
  }
  assert.equal(descriptions.size, 4);
});

test('new commercial pages are in the sitemap and unknown occasion metadata is noindex', async () => {
  const original = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ data: [] }) });
  try {
    const urls = (await load('app/sitemap.ts').default()).map(row => row.url);
    for (const route of ['/occasions', '/occasions/weddings', '/occasions/corporate', '/occasions/house-parties', '/occasions/gifting', '/bulk-drinks', '/authenticity-guarantee']) {
      assert(urls.some(url => url.endsWith(route)), route);
    }
    const missing = await load('app/occasions/[occasion]/page.tsx').generateMetadata({ params: Promise.resolve({ occasion: 'missing' }) });
    assert.equal(missing.robots.index, false);
  } finally { global.fetch = original; }
});

test('nationwide policy and city routes render current timing and are discoverable', async () => {
  const original = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ data: [] }) });
  try {
    const sitemap = await load('app/sitemap.ts').default();
    const robots = load('app/robots.ts').default();
    const origin = new URL(robots.sitemap).origin;
    assert.equal(robots.sitemap, origin + '/sitemap.xml');
    for (const [route, file, timing] of [
      ['/shipping-info', 'layout.tsx', /within 48 hours/],
      ['/delivery/abuja', 'page.tsx', /noon cutoff/],
      ['/delivery/lagos', 'page.tsx', /within 48 hours/],
    ]) {
      const page = load('app' + route + '/' + file);
      assert.equal(page.metadata.alternates.canonical, origin + route);
      assert.notEqual(page.metadata.robots?.index, false);
      assert.equal(sitemap.filter(row => row.url === origin + route).length, 1);
      assert(robots.rules.every(group => !group.disallow.some(prefix => route.startsWith(prefix))));
      assert.match(renderToStaticMarkup(React.createElement(page.default)), timing);
    }
    const shipping = load('app/shipping-info/page.tsx');
    const shippingHtml = renderToStaticMarkup(React.createElement(shipping.default));
    assert.match(shippingHtml, /Same-day delivery in Abuja.*within 48 hours/);
    assert.doesNotMatch(shippingHtml, /[0-9]+(?:–[0-9]+)? business days/);
    assert.match(shippingHtml, /href="\/delivery\/abuja"/);
    assert.match(shippingHtml, /href="\/delivery\/lagos"/);
    const faq = load('app/faqs/layout.tsx');
    const markup = renderToStaticMarkup(React.createElement(faq.default));
    const schema = JSON.parse(markup.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
    const delivery = schema.mainEntity.find(entry => entry.name === 'How long does delivery take?');
    assert.match(delivery.acceptedAnswer.text, /Same-day delivery in Abuja.*1–2 days \(within 48 hours\)/);
    const faqPage = load('app/faqs/page.tsx');
    const faqHtml = renderToStaticMarkup(React.createElement(faqPage.default));
    assert(faqHtml.includes(delivery.acceptedAnswer.text));
    assert.match(faqHtml, /href="\/shipping-info"/);
  } finally { global.fetch = original; }
});

test('enquiry intent tracking has fixed non-PII fields and works when analytics is unavailable', () => {
  const original = global.window;
  const calls = [];
  global.window = { gtag: (...args) => calls.push(args) };
  try {
    const { trackCommercialEnquiry } = load('lib/commercialEnquiry.ts');
    trackCommercialEnquiry('weddings');
    assert.deepEqual(calls, [['event', 'commercial_enquiry_click', { enquiry_type: 'weddings', contact_method: 'whatsapp' }]]);
    global.window = {};
    assert.doesNotThrow(() => trackCommercialEnquiry('bulk'));
  } finally { global.window = original; }
});

test('accepted contact enquiries emit a lead event without putting personal text in analytics', () => {
  const original = global.window;
  const calls = [];
  global.window = { gtag: (...args) => calls.push(args) };
  try {
    const { trackContactLead } = load('lib/commercialEnquiry.ts');
    trackContactLead('product');
    trackContactLead('person@example.com');
    assert.deepEqual(calls, [
      ['event', 'generate_lead', { lead_type: 'contact', contact_subject: 'product' }],
      ['event', 'generate_lead', { lead_type: 'contact', contact_subject: 'other' }],
    ]);
    global.window = { gtag() { throw new Error('Tag failed'); } };
    assert.doesNotThrow(() => trackContactLead('product'));
  } finally { global.window = original; }
});

test('age gate remains usable when browser storage is blocked', () => {
  const original = global.localStorage;
  global.localStorage = { getItem() { throw new Error('Storage blocked'); } };
  try {
    const Gate = load('components/AgeGate/AgeGate.tsx').default;
    const html = renderToStaticMarkup(React.createElement(Gate));
    assert.match(html, /role="dialog"/);
    assert.match(html, /Yes, I am 18 or older/);
  } finally { global.localStorage = original; }
});

test('review invitation appears only after delivery and links each purchased bottle once', () => {
  const Request = load('components/Product/DeliveredReviewRequest.tsx').default;
  const items = [{ product: { name: 'Gin', slug: 'test-gin' } }, { product: { name: 'Gin', slug: 'test-gin' } }, { product: null }];
  assert.equal(renderToStaticMarkup(React.createElement(Request, { status: 'pending', items })), '');
  assert.equal(renderToStaticMarkup(React.createElement(Request, { status: 'cancelled', items })), '');
  const html = renderToStaticMarkup(React.createElement(Request, { status: 'delivered', items }));
  assert.equal((html.match(/href="\/product\/test-gin"/g) || []).length, 1);
  assert.match(html, /Reviews/);
  assert.match(html, /honest feedback/i);
  assert.equal(renderToStaticMarkup(React.createElement(Request, { status: 'delivered', items: [{ product: null }] })), '');
});
