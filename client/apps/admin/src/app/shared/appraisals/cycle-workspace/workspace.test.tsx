// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { CycleHeader, CycleMetric, CycleActionPanel } from './workspace';
afterEach(cleanup);
it('shows the active cycle stage and keeps cancellation distinct from completion', () => {
  const base = {
    _id: 'cycle',
    name: 'October review',
    peerReviewEnabled: true,
  };
  const view = render(
    <CycleHeader
      cycle={{ ...base, status: 'collecting' }}
      modeLabel="Colleague bonus appraisal"
      description="Rate colleagues"
    />
  );
  expect(
    within(screen.getByRole('list', { name: 'Cycle stages' }))
      .getByText('Collecting')
      .closest('li')
      ?.getAttribute('aria-current')
  ).toBe('step');
  view.rerender(
    <CycleHeader
      cycle={{ ...base, status: 'cancelled' }}
      modeLabel="Colleague bonus appraisal"
      description="Rate colleagues"
    />
  );
  expect(screen.getByRole('status', { name: 'Cycle cancelled' })).toBeTruthy();
  expect(
    within(screen.getByRole('list', { name: 'Cycle stages' }))
      .getByText('Closed')
      .closest('li')
      ?.getAttribute('aria-current')
  ).toBeNull();
});
it('shows an honest missing percentage and explains an unavailable action', () => {
  render(
    <>
      <CycleMetric label="Submitted" value="—" detail="No participants yet" />
      <CycleActionPanel
        title="Save your roster"
        description="Choose at least two colleagues before launching."
      >
        <button disabled>Launch cycle</button>
      </CycleActionPanel>
    </>
  );
  expect(screen.getByText('—')).toBeTruthy();
  expect(
    screen.getByText('Choose at least two colleagues before launching.')
  ).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Launch cycle' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
});
