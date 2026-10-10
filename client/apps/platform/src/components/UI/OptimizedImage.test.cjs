const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(request, parent, ...args) {
  if (request === '@/components/UI/OptimizedImage') request = path.join(__dirname, 'OptimizedImage.tsx');
  if (request === '@/utils/cloudinaryImage') request = path.join(__dirname, '../../utils/cloudinaryImage.ts');
  return originalLoad.call(this, request, parent, ...args);
};
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }, fileName: filename,
  });
  module._compile(outputText, filename);
};
test('product srcset uses direct resized CDN URLs with responsive sizes', () => {
  const Image = require('./OptimizedImage.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Image, {
    src: 'https://res.cloudinary.com/drinks/image/upload/v123/bottle.jpg', alt: 'Bottle', width: 500, height: 500, sizes: '25vw',
  }));
  assert.match(html, /srcSet="https:\/\/res.cloudinary.com/);
  assert.match(html, /c_limit,w_\d+/);
  assert.match(html, /sizes="25vw"/);
  assert.doesNotMatch(html, /_next\/image/);
  assert.match(html, /loading="lazy"/);
});
test('local fallback images retain Next native optimization', () => {
  const Image = require('./OptimizedImage.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Image, { src: '/images/logo.png', alt: 'Logo', width: 100, height: 100 }));
  assert.match(html, /_next\/image/);
});

test('blog hero retains its blur placeholder and responsive CDN image', () => {
  const BlogImage = require('../../app/blog/BlogImage.tsx').default;
  const html = renderToStaticMarkup(React.createElement(BlogImage, {
    src: 'https://res.cloudinary.com/drinks/image/upload/v123/article.jpg',
    alt: 'Wine guide', fill: true, sizes: '100vw', priority: true,
  }));
  assert.match(html, /c_limit,w_\d+/);
  assert.match(html, /sizes="100vw"/);
  assert.match(html, /background-image/);
  assert.doesNotMatch(html, /loading="lazy"/);
});
