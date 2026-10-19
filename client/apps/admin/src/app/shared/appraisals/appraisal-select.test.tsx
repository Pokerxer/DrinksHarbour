// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import Select from './appraisal-select';
afterEach(cleanup);
const options = [
  { value: 'easy', label: 'Easy', description: 'AI default: 1 mark' },
  { value: 'hard', label: 'Hard', description: 'AI default: 3 marks' },
];
function Example({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState('easy');
  return (
    <>
      <Select
        label="Difficulty"
        value={value}
        options={options}
        disabled={disabled}
        onChange={setValue}
      />
      <button>Outside</button>
    </>
  );
}
it('labels its trigger, displays option context and changes selection', async () => {
  render(<Example />);
  fireEvent.click(screen.getByLabelText('Difficulty'));
  const selected = await screen.findByRole('option', { name: /Easy/ });
  expect(selected.getAttribute('aria-selected')).toBe('true');
  expect(screen.getByText('AI default: 3 marks')).toBeTruthy();
  fireEvent.click(screen.getByRole('option', { name: /Hard/ }));
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  expect(screen.getByLabelText('Difficulty').textContent).toContain('Hard');
});
it('supports arrow selection and Escape without changing the current value', async () => {
  render(<Example />);
  const trigger = screen.getByLabelText('Difficulty');
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  const list = await screen.findByRole('listbox');
  await waitFor(() => expect(document.activeElement).toBe(list));
  await waitFor(() =>
    expect(list.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: /Easy/ }).id
    )
  );
  fireEvent.keyDown(list, { key: 'End' });
  await waitFor(() =>
    expect(list.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', { name: /Hard/ }).id
    )
  );
  fireEvent.keyDown(list, { key: 'Enter' });
  await waitFor(() => expect(trigger.textContent).toContain('Hard'));
  fireEvent.click(trigger);
  const reopened = await screen.findByRole('listbox');
  fireEvent.keyDown(reopened, { key: 'Home' });
  fireEvent.keyDown(reopened, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  expect(trigger.textContent).toContain('Hard');
  expect(document.activeElement).toBe(trigger);
});
it('prevents disabled menus from opening', () => {
  render(<Example disabled />);
  const trigger = screen.getByLabelText('Difficulty') as HTMLButtonElement;
  expect(trigger.disabled).toBe(true);
  fireEvent.click(trigger);
  expect(screen.queryByRole('listbox')).toBeNull();
});
