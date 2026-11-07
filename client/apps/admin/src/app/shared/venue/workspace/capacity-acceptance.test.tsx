// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CapacityAcceptance from './capacity-acceptance';
afterEach(cleanup);
it('loads current combinations and accepts the selected exact policy version', async () => {
  const load = vi.fn(async () => ({ policyVersion: 7, options: [{ resourceIds: ['a','b'] }], asOf: new Date().toISOString(), durationMinutes: 120, timezone: 'Africa/Lagos' }));
  const accept = vi.fn(async () => true);
  render(<CapacityAcceptance tables={[{_id:'a',name:'One'},{_id:'b',name:'Two'}]} busy={false} load={load} accept={accept} />);
  fireEvent.click(screen.getByRole('button', {name:'Check booking availability'}));
  await screen.findByRole('option', {name:'One + Two'});
  fireEvent.change(screen.getByLabelText('Available tables'), {target:{value:'0'}});
  fireEvent.click(screen.getByRole('button', {name:'Accept booking'}));
  await waitFor(() => expect(accept).toHaveBeenCalledWith({resourceIds:['a','b'],policyVersion:7}));
});
it('keeps a capacity conflict visible and lets the host refresh', async () => {
  const load=vi.fn().mockRejectedValueOnce(new Error('Capacity changed; reload')).mockResolvedValueOnce({policyVersion:2,options:[],asOf:new Date().toISOString(),durationMinutes:120,timezone:'Africa/Lagos'});
  render(<CapacityAcceptance tables={[]} busy={false} load={load} accept={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', {name:'Check booking availability'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Capacity changed');
  fireEvent.click(screen.getByRole('button', {name:'Check booking availability'}));
  await screen.findByText('No tables are available for this interval.');
  expect(screen.queryByRole('button',{name:'Accept booking'})).toBeNull();
});
