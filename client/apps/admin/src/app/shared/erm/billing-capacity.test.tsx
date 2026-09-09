import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
vi.stubGlobal('React', React);
import AddOnsCard from './add-ons-card';
import CurrentPlanWidget from './current-plan-widget';
import type { ErmStatus } from '@/services/erm.service';
const status = {
  plan: 'growth', planLabel: 'Growth', subscriptionStatus: 'active',
  writesAllowed: true, canManageBilling: true, addOnsAllowed: false,
  commissionRate: 11, usage: {
    skus: { used: 10, limit: 500 }, staff: { used: 1, limit: 3 },
    warehouses: { used: 1, limit: 1 }, shops: { used: 1, limit: 2 },
  }, addOns: [{ type: 'extra_shop', label: 'Extra POS terminal', priceMonthly: 12000,
    used: 1, allowance: 2, included: 2, purchased: 0 }],
} as ErmStatus;
test('Growth shows included capacity and explains why add-ons are unavailable', () => {
  const html = renderToStaticMarkup(<AddOnsCard status={status} token="test" />);
  expect(html).toContain('2 included');
  expect(html).toContain('0 paid');
  expect(html).toContain('Add-ons unavailable');
  expect(html).not.toContain('First of each is free');
});
test('unlimited capacity never renders a null count or suggests buying another slot', () => {
  const html = renderToStaticMarkup(<AddOnsCard status={{...status, addOnsAllowed: true,
    addOns: [{...status.addOns[0], allowance: null, included: null}]}} token="test" />);
  expect(html).toContain('Unlimited');
  expect(html).not.toContain('Buy another');
});
test('over-capacity usage explains the problem and links to management', () => {
  const html = renderToStaticMarkup(<CurrentPlanWidget status={{...status,
    usage: {...status.usage, warehouses: { used: 3, limit: 2 }}}} />);
  expect(html).toContain('1 over your allowance');
  expect(html).toContain('href="/warehouses"');
  expect(html).toContain('href="/settings#point_of_sale"');
});
