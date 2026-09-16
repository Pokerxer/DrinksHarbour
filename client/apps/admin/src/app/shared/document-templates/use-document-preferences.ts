'use client';
import { useEffect, useState } from 'react';
import { useDocumentIdentity } from './use-document-identity';
import { documentPreferences } from '@/services/document-template.service';
import type { TemplatePreferences } from '@/utils/print/templates/registry';
export function useDocumentPreferences() {
  const { token, tenant, hasTenant, scope, status, isPOS } = useDocumentIdentity();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    scope: string;
    value?: TemplatePreferences;
    error?: string;
  }>();
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setState(undefined);
    if (!hasTenant) {
      setState({ scope, value: { defaultTemplate: 'classic', families: {} } });
      return;
    }
    documentPreferences(token, tenant?.slug, undefined, controller.signal, isPOS)
      .then((value) => {
        if (!controller.signal.aborted) setState({ scope, value });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            scope,
            error: error instanceof Error ? error.message : 'Unable to load document templates',
          });
      });
    return () => controller.abort();
  }, [scope, token, tenant?.slug, hasTenant, revision, isPOS]);
  const current = state?.scope === scope ? state : undefined;
  return {
    scope,
    token,
    slug: tenant?.slug,
    tenant,
    hasTenant,
    preferences: current?.value,
    error: current?.error,
    loading: status === 'loading' || Boolean(token && !current),
    reload: () => setRevision((v) => v + 1),
  };
}
