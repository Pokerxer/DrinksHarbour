// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import MoneyPolicyEditor, { gratuityDraft, serviceChargeDraft, type DraftState } from './money-policy-editor';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const draft = (over: Partial<DraftState> = {}): DraftState => ({
  enabled: true, ratePercent: '12.5', appliesTo: 'merchandise_net', taxable: true,
  taxDecision: '', displayLabel: 'Service charge 12.5%', revenueAccount: '4060',
  gratuityMode: 'none', defaultStaffIds: '', shiftPolicyRef: '', ...over,
});

test('disabled draft emits no subdocs — zero behavior change by default', () => {
  const none: DraftState = { enabled: false, ratePercent: '', appliesTo: 'merchandise_net', taxable: true, taxDecision: '', displayLabel: '', revenueAccount: '', gratuityMode: 'none', defaultStaffIds: '', shiftPolicyRef: '' };
  expect(serviceChargeDraft(none)).toBeUndefined();
  expect(gratuityDraft(none)).toBeUndefined();
});

test('service-charge draft converts authored percent to integer basis points and maps the fields', () => {
  expect(serviceChargeDraft(draft())).toEqual({
    enabled: true, rateBps: 1250, appliesTo: 'merchandise_net', taxable: true,
    displayLabel: 'Service charge 12.5%', accounts: { revenue: '4060' },
  });
  // Zero-tax carries the named decision; taxable omits it (server gate decides).
  expect(serviceChargeDraft(draft({ taxable: false, taxDecision: 'Lagos 2026 ruling' }))?.taxDecision).toBe('Lagos 2026 ruling');
  expect(serviceChargeDraft(draft())?.taxDecision).toBeUndefined();
  // A blank/invalid rate emits no rateBps rather than a wrong one (server gate rejects).
  expect(serviceChargeDraft(draft({ ratePercent: '' }))?.rateBps).toBeUndefined();
});

test('gratuity draft exposes hints only for the chosen mode', () => {
  expect(gratuityDraft(draft({ gratuityMode: 'staff', defaultStaffIds: ' s1, s2 , ' }))?.defaultStaffIds).toEqual(['s1', 's2']);
  expect(gratuityDraft(draft({ gratuityMode: 'shift', shiftPolicyRef: 'SP-9' }))).toEqual({ mode: 'shift', shiftPolicyRef: 'SP-9' });
  expect(gratuityDraft(draft({ gratuityMode: 'staff' }))?.defaultStaffIds).toBeUndefined();
});

test('editor renders the fields and mirrors the authored payload for policy review', async () => {
  render(<MoneyPolicyEditor />);
  expect(screen.queryByLabelText(/service charge rate/i)).toBeNull();
  fireEvent.click(screen.getByLabelText(/enable a service charge/i));
  fireEvent.change(screen.getByLabelText(/service charge rate/i), { target: { value: '12.5' } });
  fireEvent.change(screen.getByLabelText(/receipt label/i), { target: { value: 'Service charge 12.5%' } });
  fireEvent.change(screen.getByLabelText(/revenue account code/i), { target: { value: '4060' } });
  fireEvent.change(screen.getByLabelText(/allocation mode/i), { target: { value: 'staff' } });
  fireEvent.change(screen.getByLabelText(/default staff references/i), { target: { value: 'u1, u2' } });
  fireEvent.click(screen.getByLabelText(/tax applies to the service charge/i));
  expect(screen.getByLabelText(/named zero-tax decision/i)).toBeTruthy();
  const payload = JSON.parse(screen.getByLabelText(/additive policy payload/i).textContent || '{}') as { serviceCharge: Record<string, unknown>; gratuityAllocation: Record<string, unknown> };
  expect(payload.serviceCharge).toEqual({ enabled: true, rateBps: 1250, appliesTo: 'merchandise_net', taxable: false, taxDecision: '', displayLabel: 'Service charge 12.5%', accounts: { revenue: '4060' } });
  expect(payload.gratuityAllocation).toEqual({ mode: 'staff', defaultStaffIds: ['u1', 'u2'] });
  // The appliesTo select offers the fail-closed food_only option.
  expect((screen.getByLabelText(/^applies to/i) as HTMLSelectElement).textContent).toContain('Food only');
});
