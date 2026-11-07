'use client';
import { useState } from 'react';
import { productService } from '@/services/product.service';
import { subproductService } from '@/services/subproduct.service';
import {
  businessPresentation,
  catalogBusiness,
} from '@/utils/catalog-business';

type Mode = 'content' | 'seo';
type Draft = Record<string, string | string[]>;
const fields: Record<
  Mode,
  { key: string; label: string; limit: number; list?: boolean }[]
> = {
  content: [
    { key: 'shortDescriptionOverride', label: 'Short description', limit: 160 },
    { key: 'descriptionOverride', label: 'Description', limit: 5000 },
    {
      key: 'customKeywords',
      label: 'Product keywords (comma separated)',
      limit: 700,
      list: true,
    },
    { key: 'tenantNotes', label: 'Internal notes', limit: 1000 },
  ],
  seo: [
    { key: 'metaTitle', label: 'Search title', limit: 60 },
    { key: 'metaDescription', label: 'Search description', limit: 160 },
    { key: 'seoH1', label: 'Page heading', limit: 100 },
    {
      key: 'metaKeywords',
      label: 'Search keywords (comma separated)',
      limit: 1000,
      list: true,
    },
  ],
};
export default function BusinessGenerationPanel({
  id,
  productType,
  token,
  tenantSlug,
  target = 'listing',
  saved,
  onSaved,
}: {
  id: string;
  productType?: string;
  token: string;
  tenantSlug?: string;
  target?: 'listing' | 'product';
  saved?: Draft;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [mode, setMode] = useState<Mode>('content');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [model, setModel] = useState('');
  const business = businessPresentation[catalogBusiness(productType)].title;
  const destination = target === 'product' ? 'central product' : 'listing';
  const activeFields = (selectedMode: Mode) =>
    target === 'product' && selectedMode === 'content'
      ? [
          {
            key: 'shortDescription',
            label: 'Short description',
            limit: 160,
            list: false,
          },
          {
            key: 'description',
            label: 'Description',
            limit: 5000,
            list: false,
          },
        ]
      : fields[selectedMode];
  async function generate(nextMode: Mode) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result =
        target === 'product'
          ? await productService.generateCatalogContent(id, token, nextMode)
          : await subproductService.generateSubProductContent(
              null,
              id,
              token,
              null,
              nextMode
            );
      if (!result?.data) throw new Error('No draft returned');
      const allowed = Object.fromEntries(
        activeFields(nextMode).map((field) => [
          field.key,
          result.data[field.key] ?? (field.list ? [] : ''),
        ])
      );
      setMode(nextMode);
      setDraft(allowed);
      setModel(
        [result.metadata?.provider, result.metadata?.model]
          .filter(Boolean)
          .join(' · ')
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      if (target === 'product')
        await productService.updateProduct(id, draft, token);
      else
        await subproductService.updateSubProduct(id, draft, token, tenantSlug);
      setDraft(null);
      setMessage(`Saved to this ${destination}.`);
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Saving failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="my-6 rounded-2xl border border-gray-200 p-5"
      aria-label="AI content and SEO"
    >
      <h2 className="text-lg font-semibold">
        AI content &amp; SEO · {business}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Create a draft from this product’s recorded details. Review and edit it
        before saving to this {destination}.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !!draft}
          onClick={() => generate('content')}
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
        >
          Generate content
        </button>
        <button
          type="button"
          disabled={busy || !!draft}
          onClick={() => generate('seo')}
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
        >
          Generate SEO
        </button>
      </div>
      {busy && (
        <p role="status" className="mt-3 text-sm">
          Working…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-green-700">
          {message}
        </p>
      )}
      {draft ? (
        <div className="mt-5 space-y-4">
          <h3 className="font-medium">
            Review {mode === 'seo' ? 'SEO' : 'content'} draft
          </h3>
          {activeFields(mode).map((field) => (
            <label key={field.key} className="block text-sm font-medium">
              {field.label}
              <textarea
                className="mt-1 block w-full rounded-lg border-gray-300 text-sm"
                disabled={busy}
                maxLength={field.limit}
                rows={
                  ['descriptionOverride', 'description'].includes(field.key)
                    ? 6
                    : 2
                }
                value={
                  Array.isArray(draft[field.key])
                    ? (draft[field.key] as string[]).join(', ')
                    : draft[field.key] || ''
                }
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [field.key]: field.list
                      ? event.target.value.split(',').map((v) => v.trim())
                      : event.target.value,
                  }))
                }
              />
            </label>
          ))}
          {mode === 'seo' && (
            <div
              className="rounded-lg bg-gray-50 p-4"
              aria-label="Search preview"
            >
              <p className="text-lg text-blue-700">{draft.metaTitle}</p>
              <p className="mt-1 text-sm text-gray-600">
                {draft.metaDescription}
              </p>
            </div>
          )}
          {model && (
            <p className="text-xs text-gray-500">Generated with {model}</p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Save draft to {destination}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(null);
                setError('');
              }}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Discard draft
            </button>
          </div>
        </div>
      ) : saved?.metaTitle ? (
        <div className="mt-4 rounded-lg bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Saved SEO</p>
          <p className="font-medium">{saved.metaTitle}</p>
          <p className="text-sm">{saved.metaDescription}</p>
        </div>
      ) : null}
    </section>
  );
}
