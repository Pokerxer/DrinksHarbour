'use client';
import { useEffect, useState } from 'react';
import { useDocumentIdentity } from './use-document-identity';
import { DOCUMENT_EXPORT_EVENT, type DocumentExportRequest } from '@/utils/print/document-export';
import DocumentExportDialog from './document-export-dialog';
export default function DocumentExportHost() {
  const { scope } = useDocumentIdentity();
  const [request, setRequest] = useState<{ scope: string; value: DocumentExportRequest }>();
  useEffect(() => {
    const receive = (event: Event) =>
      setRequest({ scope, value: (event as CustomEvent<DocumentExportRequest>).detail });
    window.addEventListener(DOCUMENT_EXPORT_EVENT, receive);
    return () => window.removeEventListener(DOCUMENT_EXPORT_EVENT, receive);
  }, [scope]);
  if (!request || request.scope !== scope) return null;
  return (
    <DocumentExportDialog
      key={scope}
      request={request.value}
      onClose={() => setRequest(undefined)}
    />
  );
}
