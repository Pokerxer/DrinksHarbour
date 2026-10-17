// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import InvoiceCreateHeader from './invoice-create-header';
afterEach(cleanup);
const props = () => ({
  saving: false,
  hasLines: true,
  saveStatus: 'saved',
  dueDate: '',
  onDueDate: vi.fn(),
  onSave: vi.fn(),
  onIssue: vi.fn(),
  onPrint: vi.fn(),
  action: null,
  saveError: '',
  issueError: '',
  error: '',
  draftLabel: 'SO-1',
});
it('does not describe draft saving as invoice issuance', () => {
  render(
    <InvoiceCreateHeader
      {...props()}
      saving
      action="saving"
      saveStatus="saving"
    />
  );
  expect(
    screen
      .getByRole('button', { name: 'Saving draft…' })
      .hasAttribute('disabled')
  ).toBe(true);
  expect(screen.queryByRole('button', { name: 'Issuing…' })).toBeNull();
});
it('allows saving a zero-value draft while explaining why it cannot be issued', () => {
  const input = props();
  render(
    <InvoiceCreateHeader
      {...input}
      issueError="The invoice must have a positive total before it can be issued."
    />
  );
  expect(
    screen
      .getByRole('button', { name: 'Issue invoice' })
      .hasAttribute('disabled')
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  expect(input.onSave).toHaveBeenCalledOnce();
});
it('keeps a failed invoice action visible as an actionable message', () => {
  render(
    <InvoiceCreateHeader
      {...props()}
      error="Could not save invoice draft. Retry Save draft before continuing."
    />
  );
  expect(screen.getByRole('alert').textContent).toMatch(/Retry Save draft/);
});
