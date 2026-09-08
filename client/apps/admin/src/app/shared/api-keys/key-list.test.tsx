import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import KeyList from './key-list';
const key = {
  _id: 'key-1',
  name: 'Stock report',
  prefix: 'dhk_test',
  scopes: ['inventory:read'],
  expiresAt: '2999-01-01',
  revokedAt: null,
};
const props = {
  keys: [key],
  loading: false,
  error: '',
  canManage: true,
  busy: false,
  revokeId: null,
  setRevokeId: () => {},
  onRevoke: () => {},
};
test('revoked keys cannot offer an active revoke action', () => {
  const html = renderToStaticMarkup(
    <KeyList {...props} keys={[{ ...key, revokedAt: '2026-01-01' }]} />
  );
  expect(html).toContain('Revoked');
  expect(html).not.toContain('Revoke access');
});
test('expired keys are excluded from active count', () => {
  const html = renderToStaticMarkup(
    <KeyList {...props} keys={[{ ...key, expiresAt: '2000-01-01' }]} />
  );
  expect(html).toContain('0 active');
  expect(html).toContain('Expired');
  expect(html).not.toContain('Revoke access');
});
test('read-only members cannot revoke integrations', () => {
  expect(
    renderToStaticMarkup(<KeyList {...props} canManage={false} />)
  ).not.toContain('Revoke access');
});
test('failed loading is not presented as a successful empty list', () => {
  const html = renderToStaticMarkup(
    <KeyList {...props} keys={[]} error="Unavailable" />
  );
  expect(html).toContain('Keys could not be loaded');
  expect(html).not.toContain('No API keys yet');
});
test('confirmation identifies the affected integration and consequence', () => {
  const html = renderToStaticMarkup(<KeyList {...props} revokeId="key-1" />);
  expect(html).toContain('Stock report');
  expect(html).toContain('working immediately');
  expect(html).toContain('Confirm revoke');
});
