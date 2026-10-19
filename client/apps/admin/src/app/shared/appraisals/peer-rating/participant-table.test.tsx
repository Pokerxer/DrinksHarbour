// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import ParticipantTable from './participant-table';
import type { PeerParticipant } from '@/services/peerAppraisal.service';
afterEach(cleanup);
const participants: PeerParticipant[] = ['Ada', 'Ben', 'Chris'].map(
  (displayName, i) => ({
    employee: String(i),
    displayName,
    isAppraiser: i < 2,
    allocationMinor: 5000000,
    submittedAt: i < 2 ? '2026-10-19' : null,
    unavailable: false,
    result: {
      averageScore: [4, 5, 2][i],
      ratingCount: i < 2 ? 1 : 2,
      bonusMinor: [4000000, 5000000, 2000000][i],
      allocationMinor: 5000000,
      currency: 'NGN',
    },
  })
);
it('shows every employee’s final score and the eligible appraisers used for it', () => {
  render(<ParticipantTable participants={participants} closed />);
  const ada = within(screen.getByRole('row', { name: /Ada/ }));
  const chris = within(screen.getByRole('row', { name: /Chris/ }));
  expect(ada.getByText('4.00 / 5')).toBeTruthy();
  expect(ada.getByText('Based on 1 eligible appraiser')).toBeTruthy();
  expect(chris.getByText('2.00 / 5')).toBeTruthy();
  expect(chris.getByText('Based on 2 eligible appraisers')).toBeTruthy();
  expect(
    within(screen.getByRole('row', { name: /Ben/ })).getByText('5.00 / 5')
  ).toBeTruthy();
});
it('keeps scores, bonuses and their denominator hidden before closure', () => {
  render(<ParticipantTable participants={participants} closed={false} />);
  expect(screen.queryByRole('columnheader', { name: 'Score' })).toBeNull();
  expect(screen.queryByRole('columnheader', { name: 'Bonus' })).toBeNull();
  expect(screen.queryByText(/Based on/)).toBeNull();
  expect(screen.queryByText('4.00 / 5')).toBeNull();
});
it('does not invent a denominator for a missing result', () => {
  render(
    <ParticipantTable
      participants={[{ ...participants[0], result: undefined }]}
      closed
    />
  );
  expect(screen.queryByText(/Based on/)).toBeNull();
});
