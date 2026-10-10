const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks = {}) {
  const fixture = new Module(file, module);
  fixture.paths = module.paths;
  fixture.require = request => {
    if (request.endsWith('.css') || request.startsWith('swiper/css')) return {};
    if (mocks[request]) return { __esModule: true, ...mocks[request] };
    const aliases = {
      '@/components/UI/OptimizedImage': path.join(__dirname, '../UI/OptimizedImage.tsx'),
      '@/utils/cloudinaryImage': path.join(__dirname, '../../utils/cloudinaryImage.ts'),
    };
    if (aliases[request]) return load(aliases[request], mocks);
    if (request.startsWith('./')) {
      const base = path.resolve(path.dirname(file), request);
      const found = ['.ts', '.tsx'].map(ext => base + ext).find(p => fs.existsSync(p));
      if (found) return load(found, mocks);
    }
    return require(request);
  };
  fixture._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: file,
  }).outputText, file);
  return fixture.exports;
}
const mocks = {
  'swiper/react': { Swiper: ({ children }) => React.createElement('div', null, children), SwiperSlide: ({ children }) => React.createElement('div', null, children) },
  'swiper/modules': { Autoplay: {}, Navigation: {} },
  '@/context/ModalQuickviewContext': { useModalQuickviewContext: () => ({}) },
  '@/components/StockStatus': { StockStatus: () => null },
  '@/lib/api': { API_URL: 'https://api.test' },
  './FlashSaleCountdown': { default: () => null },
};
test('complete flash-sale seed renders product links and responsive CDN images on server', () => {
  const FlashSale = load(path.join(__dirname, 'FlashSale.tsx'), mocks).default;
  const html = renderToStaticMarkup(React.createElement(FlashSale, {
    flashOnly: true, initialProductsComplete: true,
    initialProducts: [{ _id: 'sale', name: 'Sale bottle', slug: 'sale-bottle', primaryImage: { url: 'https://res.cloudinary.com/drinks/image/upload/v123/bottle.jpg' }, availableAt: [{ isOnSale: true, saleType: 'flash_sale', saleDiscountValue: 20, sizes: [{ size: '750ml', stock: 10, pricing: { websitePrice: 8000 }, discount: { hasDiscount: true, originalPrice: 10000, percentage: 20 } }] }] }],
  }));
  assert.match(html, /href="\/product\/sale-bottle"/);
  assert.match(html, /c_limit,w_\d+/);
  assert.doesNotMatch(html, /_next\/image/);
});
test('a complete empty sale seed renders no loading skeleton', () => {
  const FlashSale = load(path.join(__dirname, 'FlashSale.tsx'), mocks).default;
  assert.equal(renderToStaticMarkup(React.createElement(FlashSale, { flashOnly: true, initialProductsComplete: true, initialProducts: [] })), '');
});
test('successful empty server request marks its seed complete', async () => {
  const originalUrl = process.env.NEXT_PUBLIC_API_URL;
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
  const HomeFlashSale = load(path.join(__dirname, 'HomeFlashSale.tsx'), {
    './FlashSale': { default: () => null },
    './flash-sale-data': { fetchFlashSaleProducts: async () => [] },
  }).default;
  try {
    const element = await HomeFlashSale();
    assert.equal(element.props.initialProductsComplete, true);
    assert.deepEqual(element.props.initialProducts, []);
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalUrl;
  }
});
test('server countdown markup stays stable until the browser starts the clock', () => {
  const Countdown = load(path.join(__dirname, 'FlashSaleCountdown.tsx')).default;
  const originalNow = Date.now;
  try {
    const endTime = new Date('2026-10-11T00:00:00Z');
    Date.now = () => endTime.getTime() - 10000;
    const server = renderToStaticMarkup(React.createElement(Countdown, { endTime }));
    Date.now = () => endTime.getTime() - 5000;
    const browser = renderToStaticMarkup(React.createElement(Countdown, { endTime }));
    assert.equal(server, browser);
    assert.match(server, /--:--:--/);
  } finally { Date.now = originalNow; }
});
