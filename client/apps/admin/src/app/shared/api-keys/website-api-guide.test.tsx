import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import WebsiteApiGuide from './website-api-guide';
import CreateKeyForm from './create-key-form';
import { WEBSITE_SCOPES, apiKeyScopeLabel } from '@/services/api-key.service';
test('website preset includes the catalogue and checkout grants explicitly', () => {
  expect(WEBSITE_SCOPES).toEqual(['storefront:read', 'checkout:write']);
  expect(apiKeyScopeLabel('checkout:write')).toBe(
    'Create and verify checkouts'
  );
});
test('key creation offers a website preset and clear store/checkout permissions', () => {
  const html = renderToStaticMarkup(
    <CreateKeyForm busy={false} bookings={false} onCreate={async () => true} />
  );
  expect(html).toContain('Tenant website');
  expect(html).toContain('Read storefront');
  expect(html).toContain('Create and verify checkouts');
  expect(html).not.toContain('Read bookings');
});
test('guide provides API base, checkout lifecycle and server-only secret example', () => {
  const html = renderToStaticMarkup(<WebsiteApiGuide />);
  expect(html).toContain('/api/integrations/v1');
  expect(html).toContain('DRINKSHARBOUR_API_KEY');
  expect(html).toContain('/cart/quote');
  expect(html).toContain('/checkout/:id/verify');
  expect(html).toContain('Idempotency-Key');
  expect(html).toContain('website server');
});
