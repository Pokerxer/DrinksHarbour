'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getAdminTenantById, type AdminTenant } from '@/services/tenant.service';

export function useTenantRecord(id: string) {
  const { data: session, status } = useSession();
  const token = session?.user?.token ?? '';
  const [tenant, setTenant] = useState<AdminTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const reload = useCallback(async () => {
    const current = ++request.current;
    if (status === 'loading') return;
    if (!token || !id) { setLoading(false); setError('Sign in to view this tenant'); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await getAdminTenantById(token, id);
      if (request.current === current) setTenant(result.tenant);
    } catch (error) {
      if (request.current === current) setError(error instanceof Error ? error.message : 'Unable to load tenant');
    } finally {
      if (request.current === current) setLoading(false);
    }
  }, [id, token, status]);
  useEffect(() => { void reload(); return () => { request.current++; }; }, [reload]);
  return { tenant, loading, error, reload, token };
}
