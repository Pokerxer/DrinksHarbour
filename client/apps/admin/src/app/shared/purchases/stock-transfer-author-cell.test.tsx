// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import StockTransferAuthorCell from './stock-transfer-author-cell';
afterEach(cleanup);
it('shows creator identity and email with initials', () => {
  render(
    <StockTransferAuthorCell
      creator={{ _id: 'u', name: 'Ada Okafor', email: 'ada@example.test' }}
    />,
  );
  expect(screen.getByText('Ada Okafor')).toBeTruthy();
  expect(screen.getByText('ada@example.test')).toBeTruthy();
  expect(screen.getByText('AO')).toBeTruthy();
});
it('uses stored first/last names when the display name is absent', () => {
  render(<StockTransferAuthorCell creator={{ _id: 'u', firstName: 'Ada', lastName: 'Okafor' }} />);
  expect(screen.getByText('Ada Okafor')).toBeTruthy();
});
it('falls back to email when no name is available without duplicating it', () => {
  render(<StockTransferAuthorCell creator={{ _id: 'u', email: 'ada@example.test' }} />);
  expect(screen.getAllByText('ada@example.test')).toHaveLength(1);
});
it('shows an explicit unavailable state for missing creators', () => {
  render(<StockTransferAuthorCell />);
  expect(screen.getByText('Unknown user')).toBeTruthy();
});
