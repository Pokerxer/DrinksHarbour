// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SalesEditorSelect from './sales-editor-select';
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('payment terms can be selected by keyboard without changing stored values', async () => {
  const change = vi.fn();
  render(
    <SalesEditorSelect
      label="Payment terms"
      value="immediate"
      onChange={change}
      options={[
        { value: 'immediate', label: 'Immediate payment' },
        { value: 'net30', label: '30 days' },
      ]}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /Payment terms/i }));
  const list = screen.getByRole('listbox');
  fireEvent.keyDown(list, { key: 'ArrowDown' });
  await waitFor(() =>
    expect(
      screen.getByRole('option', { name: '30 days' }).hasAttribute('data-focus')
    ).toBe(true)
  );
  fireEvent.keyDown(list, { key: 'Enter' });
  await waitFor(() => expect(change).toHaveBeenCalledWith('net30'));
});
it('disabled invoice actions keep dropdown selection disabled', () => {
  render(
    <SalesEditorSelect
      label="Payment terms"
      value="immediate"
      onChange={vi.fn()}
      disabled
      options={[{ value: 'immediate', label: 'Immediate payment' }]}
    />
  );
  expect(
    (
      screen.getByRole('button', {
        name: /Payment terms/i,
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
});
