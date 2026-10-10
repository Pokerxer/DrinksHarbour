import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import WebsiteApiGuide from './website-api-guide';

test('API settings provide navigation to a dedicated reference page', () => {
  const html = renderToStaticMarkup(<WebsiteApiGuide />);
  expect(html).toContain('href="/settings/api-keys/documentation"');
  expect(html).toContain('Full API documentation');
});

test('dedicated documentation explains every payment recovery action and navigation', async () => {
  const { default: ApiDocumentation } = await import('./api-documentation');
  const html = renderToStaticMarkup(<ApiDocumentation />);
  expect(html).toContain('Tenant website REST API');
  expect(html).toContain('href="/settings/api-keys"');
  for (const id of [
    'connection',
    'customers',
    'catalogue',
    'banners',
    'checkout',
    'recovery',
    'errors',
    'deployment',
  ]) {
    expect(html).toContain(`href="#${id}"`);
    expect(html).toContain(`id="${id}"`);
  }
  for (const action of [
    '/store',
    '/customers/register',
    '/customers/login',
    '/customers/me',
    '/customers/reset-password/:token',
    '/banners',
    '/products/:id',
    '/cart/quote',
    '/checkout/:id/verify',
    '/checkout/:id/cancel',
  ]) {
    expect(html).toContain(action);
  }
  expect(html).toContain('issuing key');
  expect(html).toContain('needs_review');
  expect(html).toContain('Retry-After');
  expect(html).toContain('PAYSTACK_SECRET_KEY');
  expect(html).toContain('replica set');
  expect(html).not.toContain('Full API documentation');
});

test('documentation inherits tenant API settings access rules', async () => {
  const { roleCanAccessRoute } = await import('@/config/route-roles');
  const path = '/settings/api-keys/documentation';
  expect(roleCanAccessRoute(path, 'tenant_owner')).toBe(true);
  expect(roleCanAccessRoute(path, 'tenant_admin')).toBe(true);
  expect(roleCanAccessRoute(path, 'tenant_staff')).toBe(false);
  expect(roleCanAccessRoute(path, 'tenant_staff', ['settings:read'])).toBe(
    true
  );
  expect(roleCanAccessRoute(path, 'customer')).toBe(false);
});
