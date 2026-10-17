// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FormDialog from './FormDialog';

afterEach(cleanup);

it('names the dialog, exposes a close button and keeps external form submission working', () => {
  const close = vi.fn();
  const submit = vi.fn((event) => event.preventDefault());
  render(
    <FormDialog
      open
      onClose={close}
      title="Create brand"
      description="Add a catalog brand"
      footer={
        <button type="submit" form="brand-form">
          Create brand
        </button>
      }
    >
      <form id="brand-form" onSubmit={submit}>
        <label>
          Brand name
          <input />
        </label>
      </form>
    </FormDialog>
  );
  expect(screen.getByRole('dialog', { name: 'Create brand' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Create brand' }));
  expect(submit).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Close Create brand' }));
  expect(close).toHaveBeenCalledTimes(1);
});

it('disables dismissal while saving and does not render when closed', () => {
  const close = vi.fn();
  const { rerender } = render(
    <FormDialog open busy onClose={close} title="Create brand">
      Fields
    </FormDialog>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close Create brand' }));
  expect(close).not.toHaveBeenCalled();
  rerender(
    <FormDialog open={false} onClose={close} title="Create brand">
      Fields
    </FormDialog>
  );
  expect(screen.queryByRole('dialog')).toBeNull();
});
