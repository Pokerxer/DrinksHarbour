'use client';
import { useEffect, useState } from 'react';
import type { DocumentModel } from '@/utils/print/doc-model';
export default function PdfPreview({ model }: { model: DocumentModel }) {
  const [state, setState] = useState<{
    model: DocumentModel;
    url?: string;
    error?: string;
  }>();
  useEffect(() => {
    let active = true,
      url: string | undefined;
    import('@/utils/print/pdf-render')
      .then(({ renderDocument }) => {
        if (!active) return;
        url = URL.createObjectURL(renderDocument(model).output('blob'));
        setState({ model, url });
      })
      .catch(() => {
        if (active)
          setState({ model, error: 'Unable to render this document.' });
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [model]);
  if (state?.model !== model)
    return (
      <p role="status" className="p-8">
        Preparing preview…
      </p>
    );
  if (state.error) return <p role="alert">{state.error}</p>;
  return (
    <div className="space-y-2">
      <iframe
        title={`${model.docTitle} PDF preview`}
        src={state.url}
        className="h-[65vh] min-h-96 w-full rounded-lg border bg-gray-100"
      />
      <div className="flex flex-wrap gap-4">
        <a
          className="text-sm font-medium text-primary underline"
          download={`${model.docTitle}-sample.pdf`}
          href={state.url}
        >
          Download sample PDF
        </a>
        <a
          className="text-sm underline"
          href={state.url}
          target="_blank"
          rel="noreferrer"
        >
          Open PDF in a new tab
        </a>
      </div>
    </div>
  );
}
