import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ProductResult } from '../../../components/price-checker/product-result';
import type {
  KioskConfig,
  KioskProduct,
} from '../../../components/price-checker/types';
const config: KioskConfig = {
  slug: 'counter',
  currency: 'NGN',
  store: { name: 'Store', location: 'Branch' },
  settings: {
    displayImages: true,
    displayTenantName: false,
    displayBrand: true,
    displaySize: true,
    displayStockStatus: true,
    displayStockQuantity: false,
    displayPromotions: true,
    displayDiscountPercentage: true,
    displayStoreName: true,
    displayBarcode: false,
    manualEntry: true,
    fullscreen: true,
    resetSeconds: 8,
    outOfStock: 'DISPLAY',
    theme: 'light',
    welcomeMessage: '',
    resultMessage: 'Ask staff',
    notFoundMessage: 'Not found',
    logo: '',
    background: '',
    accent: '#b20202',
  },
};
const product: KioskProduct = {
  name: 'Test beverage',
  price: 1800,
  currency: 'NGN',
  alcoholic: false,
  taxLabel: '',
  size: '70cl',
  availability: 'LOW_STOCK',
  originalPrice: 2000,
  savings: 200,
  discountPercentage: 10,
};
test('result renders exact size, dominant price, savings and availability with no checkout controls', () => {
  const html = renderToStaticMarkup(createElement(ProductResult, { config, product }));
  expect(html).toContain('Test beverage');
  expect(html).toContain('70cl');
  expect(html).toContain('1,800');
  expect(html).toContain('10% off');
  expect(html).toContain('Low stock');
  expect(html).not.toContain('Add to cart');
  expect(html).not.toContain('Checkout');
});
test('alcohol price is gated per result until adult confirmation', () => {
  const html = renderToStaticMarkup(
    createElement(ProductResult, { config, product: { ...product, alcoholic: true } })
  );
  expect(html).toContain('Are you 18 or older?');
  expect(html).not.toContain('1,800');
});
