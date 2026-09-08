'use client';
import Link from 'next/link';
import { routes } from '@/config/routes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { withDocumentIssuer } from '@/utils/print/document-issuer';
import type { DocumentExportRequest } from '@/utils/print/document-export';
import { resolveTemplate, TEMPLATES, type TemplateId } from '@/utils/print/templates/registry';
import { useDocumentPreferences } from './use-document-preferences';
import PdfPreview from './pdf-preview';
export default function DocumentExportDialog({
  request,
  onClose,
}: {
  request: DocumentExportRequest;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(true);
  const { preferences, error, loading, reload, tenant, token } = useDocumentPreferences();
  const [override, setOverride] = useState<TemplateId>();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    return () => {
      alive.current = false;
    };
  }, []);
  const original = request.models[index] ?? request.models[0];
  const selected = resolveTemplate(preferences, original.kind, override ?? original.templateId);
  const model = useMemo(
    () => withDocumentIssuer({ ...original, templateId: selected }, tenant),
    [original, selected, tenant]
  );
  async function download(all = false) {
    setBusy(true);
    setExportError('');
    try {
      const { renderDocument, renderDocuments } = await import('@/utils/print/pdf-render');
      if (!alive.current) return;
      if (all)
        renderDocuments(
          request.models.map((item) =>
            withDocumentIssuer(
              {
                ...item,
                templateId: resolveTemplate(preferences, item.kind, override ?? item.templateId),
              },
              tenant
            )
          )
        ).save('documents.pdf');
      else renderDocument(model).save(model.fileName);
    } catch {
      setExportError('Unable to download the PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="document-export-title"
      className="fixed inset-0 z-[10000] m-auto max-h-[94vh] w-[min(1100px,95vw)] overflow-auto rounded-2xl bg-white p-6 text-gray-900 shadow-2xl backdrop:bg-black/50"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 id="document-export-title" className="text-xl font-semibold">
            Preview & export
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose a style for this document. Saved defaults stay unchanged.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded border px-3 py-2">
          Close
        </button>
      </div>
      {loading ? (
        <p role="status">Loading your saved style…</p>
      ) : error ? (
        <div role="alert">
          {error}{' '}
          <button type="button" onClick={reload} className="underline">
            Retry
          </button>
        </div>
      ) : !token ? (
        <p role="alert">Sign in to export documents.</p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-end gap-4">
            <label className="grid gap-1 text-sm">
              Template
              <select
                value={selected}
                onChange={(e) => setOverride(e.target.value as TemplateId)}
                className="rounded-lg border-gray-300"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {request.models.length > 1 && (
              <label className="grid gap-1 text-sm">
                Document
                <select
                  value={index}
                  onChange={(e) => setIndex(Number(e.target.value))}
                  className="rounded-lg border-gray-300"
                >
                  {request.models.map((m, i) => (
                    <option key={i} value={i}>
                      {i + 1}. {m.number}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => download()}
              className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Preparing…' : 'Download PDF'}
            </button>
            {request.models.length > 1 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => download(true)}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Download all as one PDF
              </button>
            )}
            <Link href={routes.documentTemplates} onClick={onClose} className="py-2 text-sm underline">
              Manage defaults
            </Link>
          </div>
          {request.models.length > 1 && (
            <p className="mb-3 text-sm text-gray-500">
              {request.models.length} documents selected. Choose each document above to preview and
              download.
            </p>
          )}
          {exportError && (
            <p role="alert" className="mb-3 text-red-700">
              {exportError}
            </p>
          )}
          <PdfPreview model={model} />
          <p className="mt-3 text-xs text-gray-500">
            Use the PDF preview’s print control, or open it in a new tab to print.
          </p>
        </>
      )}
    </dialog>
  );
}
