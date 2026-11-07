// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import BusinessSpecifications from './business-specifications';
import { defaultValues } from './form-utils';
import registry from '@/utils/business-specifications.json';
afterEach(cleanup);
function Form({ type, onSave }: { type: string; onSave: (value: unknown) => void }) {
  const methods = useForm({ defaultValues: { type, specifications: { material: 'Oak' } } });
  return <FormProvider {...methods}><form onSubmit={methods.handleSubmit(onSave)}><BusinessSpecifications /><button type="submit">Save</button></form></FormProvider>;
}
it('existing form reviews and edits generated specifications', async () => {
  let saved: unknown;
  render(<Form type="home_furniture" onSave={value => { saved = value; }} />);
  const material = screen.getByLabelText('material');
  expect((material as HTMLTextAreaElement).value).toBe('Oak');
  fireEvent.change(material, {target:{value:'Solid oak'}});
  fireEvent.click(screen.getByRole('button',{name:'Save'}));
  await waitFor(() => expect(saved).toMatchObject({specifications:{material:'Solid oak'}}));
  expect(screen.queryByLabelText('processor')).toBeNull();
});
it('beverages keep their existing fields without a second specification section', () => {
  render(<Form type="whisky" onSave={() => {}} />);
  expect(screen.queryByText('Product specifications')).toBeNull();
});
it('form defaults retain saved specifications', () => {
  expect(defaultValues({specifications:{material:'Oak'}} as never).specifications).toEqual({material:'Oak'});
});
it('every business has bounded editable fields', () => {
  expect(Object.keys(registry)).toHaveLength(6);
});
