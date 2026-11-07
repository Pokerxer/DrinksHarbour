 'use client';
import { useFormContext } from 'react-hook-form';
import { CreateProductInput } from '@/validators/create-product.schema';
import { catalogBusiness } from '@/utils/catalog-business';
import registry from '@/utils/business-specifications.json';
export default function BusinessSpecifications() {
  const { register, watch } = useFormContext<CreateProductInput>();
  const business = catalogBusiness(watch('type'));
  const fields = (registry as Record<string, string[]>)[business] || [];
  if (!fields.length) return null;
  return <fieldset className="mb-6 space-y-4">
    <legend className="font-semibold">Product specifications</legend>
    <p className="text-sm text-gray-500">Generate Product fills verified specifications here. Review before saving. Leave unknown details blank; include measurement units.</p>
    <div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <label key={field} className="text-sm">
      <span className="mb-1 block capitalize">{field.replace(/([A-Z])/g, ' $1')}</span>
      <textarea {...register(`specifications.${field}`)} maxLength={1000} rows={2} className="w-full rounded-md border border-gray-300 p-2" />
    </label>)}</div>
  </fieldset>;
}
