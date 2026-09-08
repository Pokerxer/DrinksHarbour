'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import { DOCUMENT_EXPORT_EVENT, type DocumentExportRequest } from '@/utils/print/document-export';
import DocumentExportDialog from './document-export-dialog';
export default function DocumentExportHost() {
  const { tenant } = useTenant();
  const { data: session } = useSession();
  const user = session?.user as { token?: string; tenantId?: string } | undefined;
  const scope = `${user?.token}:${tenant?._id ?? user?.tenantId}:${tenant?.slug}`;
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
