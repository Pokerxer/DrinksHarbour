'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthorization } from '@/hooks/use-authorization';
import { documentPreferences } from '@/services/document-template.service';
import {
  TEMPLATES,
  resolveTemplate,
  type DocumentFamily,
  type TemplatePreferences,
} from '@/utils/print/templates/registry';
import { useDocumentPreferences } from './use-document-preferences';
import { templateSample } from './template-sample';
import TemplateCard from './template-card';
import PdfPreview from './pdf-preview';
import SettingsPageHeader from '@/app/shared/settings/settings-page-header';
const FAMILIES: [DocumentFamily, string][] = [
  ['sales', 'Sales & quotations'],
  ['purchases', 'Purchases & bills'],
  ['pricelist', 'Price lists'],
  ['stock', 'Stock & transfers'],
];
export default function DocumentTemplateSettings() {
  const state = useDocumentPreferences();
  if (state.loading) return <p role="status">Loading document templates…</p>;
  if (state.error)
    return (
      <p role="alert">
        {state.error}{' '}
        <button onClick={state.reload} className="underline">
          Retry
        </button>
      </p>
    );
  if (!state.hasTenant)
    return (
      <p>Sign in with a tenant account to manage its document templates.</p>
    );
  if (!state.preferences) return <p>Sign in to manage document templates.</p>;
  return (
    <SettingsForm key={state.scope} state={state} initial={state.preferences} />
  );
}
function SettingsForm({
  state,
  initial,
}: {
  state: ReturnType<typeof useDocumentPreferences>;
  initial: TemplatePreferences;
}) {
  const { checkPermission } = useAuthorization();
  const canSave = checkPermission('settings:write');
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [family, setFamily] = useState<DocumentFamily>('sales');
  const [preview, setPreview] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const saving = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const sample = useMemo(
    () => ({
      ...templateSample(family, state.tenant?.name),
      templateId: resolveTemplate(
        draft,
        family === 'purchases'
          ? 'po'
          : family === 'stock'
            ? 'stock'
            : family === 'pricelist'
              ? 'pricelist'
              : 'quotation'
      ),
    }),
    [family, state.tenant?.name, draft]
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  async function save() {
    if (!canSave || !dirty || saving.current) return;
    saving.current = true;
    setSaveError(false);
    setBusy(true);
    setMessage('');
    try {
      const result = await documentPreferences(state.token, state.slug, draft);
      if (alive.current) {
        setSaved(result);
        setDraft(result);
        setMessage('Document defaults saved.');
      }
    } catch (e) {
      if (alive.current) {
        setSaveError(true);
        setMessage(
          e instanceof Error ? e.message : 'Unable to save. Please retry.'
        );
      }
    } finally {
      saving.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <SettingsPageHeader
        title="Document templates"
        eyebrow="Your business, on paper"
        description={`Choose a consistent look for ${state.tenant?.name ?? 'your business'}. Preview eight styles and set defaults for invoices, purchases, price lists and stock documents.`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {dirty && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(saved);
                setMessage('');
              }}
              className="rounded-lg border border-muted px-4 py-3 text-sm font-medium disabled:opacity-40"
            >
              Reset changes
            </button>
          )}
          <button
            type="button"
            disabled={!canSave || !dirty || busy}
            onClick={save}
            className="rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Save defaults'}
          </button>
        </div>
      </SettingsPageHeader>
      {dirty && (
        <p role="status" className="text-sm text-amber-700">
          Unsaved changes — save to apply these styles to future documents.
        </p>
      )}
      {message && (
        <p
          role={saveError ? 'alert' : 'status'}
          className={`rounded-lg border p-3 text-sm ${saveError ? 'border-red-200 text-red-600' : 'border-green-200 text-green-700'}`}
        >
          {message}
        </p>
      )}
      {!canSave && (
        <p className="text-sm text-gray-500">
          You can preview styles. A user with settings access can save the
          defaults.
        </p>
      )}
      <fieldset
        disabled={busy}
        className="grid grid-cols-1 gap-4 disabled:opacity-60 min-[400px]:grid-cols-2 lg:grid-cols-4"
      >
        <legend className="mb-4 text-lg font-semibold">Business default</legend>
        {TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            selected={draft.defaultTemplate === t.id}
            onSelect={() => setDraft((d) => ({ ...d, defaultTemplate: t.id }))}
          />
        ))}
      </fieldset>
      <section className="rounded-2xl border border-muted bg-white p-5 dark:bg-gray-50 sm:p-6">
        <h2 className="text-lg font-semibold">Defaults by document type</h2>
        <p className="mt-1 text-sm text-gray-500">
          Use your business default everywhere, or choose a different style for
          a document family.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FAMILIES.map(([key, label]) => (
            <label key={key} className="grid gap-2 text-sm font-medium">
              {label}
              <select
                className="rounded-lg border-muted bg-transparent text-sm focus:border-primary focus:ring-primary"
                disabled={busy}
                value={draft.families?.[key] ?? ''}
                onChange={(e) => {
                  const families = { ...draft.families };
                  if (e.target.value) families[key] = e.target.value;
                  else delete families[key];
                  setDraft((d) => ({ ...d, families }));
                }}
              >
                <option value="">Use business default</option>
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>
      <section className="space-y-4 rounded-2xl border border-muted p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-semibold">Live document preview</h2>
          <label className="sr-only" htmlFor="preview-family">
            Preview document type
          </label>
          <select
            id="preview-family"
            value={family}
            onChange={(e) => setFamily(e.target.value as DocumentFamily)}
            className="rounded-lg border-muted bg-transparent text-sm focus:border-primary focus:ring-primary"
          >
            {FAMILIES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            {preview ? 'Hide preview' : 'Preview PDF'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Sample data only. This preview includes your unsaved style selections.
        </p>
        {preview && <PdfPreview model={sample} />}
      </section>
    </div>
  );
}
