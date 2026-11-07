// @vitest-environment jsdom
import React, { createRef } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { UseFormSetValue, FieldValues } from 'react-hook-form';
import CatalogFormEffects from './catalog-form-effects';
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));
afterEach(cleanup);
const props = () => ({
  name: 'New Wine',
  id: undefined,
  manualSlug: { current: false },
  slugify: (s: string) => s.toLowerCase().replaceAll(' ', '-'),
  setValue: vi.fn() as unknown as UseFormSetValue<FieldValues>,
  errors: {},
  submitCount: 0,
  suggestions: null,
  clearSuggestions: vi.fn(),
  draft: null,
  draftFields: ['name', 'type'],
  parentField: 'parent',
  allowedValues: { type: ['wine'] },
  defaults: {},
  requiredDraftField: { name: 'type', message: 'Choose a type' },
});
test('auto slug respects manual editing and existing records', () => {
  const input = props();
  const { rerender } = render(<CatalogFormEffects {...input} />);
  expect(input.setValue).toHaveBeenCalledWith('slug', 'new-wine', {
    shouldValidate: false,
  });
  vi.mocked(input.setValue).mockClear();
  input.manualSlug.current = true;
  rerender(<CatalogFormEffects {...input} name="Changed Wine" />);
  expect(input.setValue).not.toHaveBeenCalled();
});
test('AI suggestions cannot overwrite identity or parent fields', () => {
  const input = props();
  render(
    <CatalogFormEffects
      {...input}
      id="existing"
      suggestions={{
        name: 'Wrong',
        slug: 'wrong',
        parent: 'wrong',
        description: 'Updated',
      }}
    />
  );
  expect(input.setValue).toHaveBeenCalledTimes(1);
  expect(input.setValue).toHaveBeenCalledWith('description', 'Updated', {
    shouldValidate: true,
    shouldDirty: true,
  });
  expect(input.clearSuggestions).toHaveBeenCalledOnce();
});
test('one accepted AI draft applies once without overwriting later manual edits', () => {
  const input = props(),
    draft = { name: 'Draft Wine', type: 'wine' };
  const { rerender } = render(<CatalogFormEffects {...input} draft={draft} />);
  expect(input.setValue).toHaveBeenCalledWith('name', 'Draft Wine', {
    shouldValidate: true,
    shouldDirty: true,
  });
  vi.mocked(input.setValue).mockClear();
  rerender(
    <CatalogFormEffects
      {...input}
      draft={draft}
      allowedValues={{ type: ['wine'] }}
    />
  );
  expect(input.setValue).not.toHaveBeenCalled();
});
