import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import {
  EMPTY_BANNER_FORM,
  bannerFormValues,
  bannerLinkedTarget,
} from './form-data';
import { StatusVisibilitySection } from './form-sections-settings';
const props = {
  formData: {
    ...EMPTY_BANNER_FORM,
    status: 'draft' as const,
    visibleTo: 'all' as const,
    isActive: false,
    isGlobal: false,
  },
  set: () => {},
  deviceTargeting: { desktop: true, mobile: true, tablet: true },
  setDeviceTargeting: () => {},
};
test('tenant editor explains store ownership and hides the platform global toggle', () => {
  const html = renderToStaticMarkup(
    <StatusVisibilitySection {...props} canManageGlobal={false} />
  );
  expect(html).not.toContain('Global Banner');
  expect(html).toContain('Only your store');
});

test('platform editor retains the global banner control', () => {
  const html = renderToStaticMarkup(
    <StatusVisibilitySection {...props} canManageGlobal />
  );
  expect(html).toContain('Global Banner');
  expect(html).not.toContain('Only your store');
});

test('editing preserves zero styling values, inactive status and mobile images', () => {
  const values = bannerFormValues({
    _id: 'banner',
    gradientIntensity: 0,
    blurIntensity: 0,
    isActive: false,
    status: 'paused',
    mobileImage: { url: 'https://example.com/mobile.png' },
  } as Parameters<typeof bannerFormValues>[0]);
  expect(values.gradientIntensity).toBe(0);
  expect(values.blurIntensity).toBe(0);
  expect(values.isActive).toBe(false);
  expect(values.status).toBe('paused');
  expect(values.mobileImage?.url).toBe('https://example.com/mobile.png');
  expect(
    bannerLinkedTarget(undefined, 'product', 'product', '/product/test-wine')
  ).toEqual({ _id: 'test-wine', name: 'test wine' });
});
