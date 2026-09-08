import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import PlanConfirmation from './plan-confirmation';
import type { ErmPlan } from '@/services/erm.service';
const plan = { key: 'growth', label: 'Growth', priceMonthly: 35000 } as ErmPlan;
test('payment failure remains visible within the confirmation dialog', () => {
  const html = renderToStaticMarkup(
    <PlanConfirmation
      plan={plan}
      hasSubscription={false}
      busy={false}
      blocked={false}
      error="Paystack is unavailable"
      onConfirm={() => {}}
      onClose={() => {}}
    />
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain('Paystack is unavailable');
  expect(html).toContain('35,000');
  expect(html).toContain('Go back');
});
test('checking pending changes disables confirmation', () => {
  const html = renderToStaticMarkup(
    <PlanConfirmation
      plan={plan}
      hasSubscription
      busy={false}
      blocked
      error={null}
      onConfirm={() => {}}
      onClose={() => {}}
    />
  );
  expect(html).toMatch(/<button[^>]*disabled[^>]*>Confirm change<\/button>/);
});
