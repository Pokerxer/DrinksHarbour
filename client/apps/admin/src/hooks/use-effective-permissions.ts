'use client';
import { useEffect, useState } from 'react';
import type { Permission } from '@/types/authorization';

export function useEffectivePermissions(token?: string) {
  const [state, setState] = useState<{ token: string; permissions: Permission[]; customPermissions: Permission[] } | null>(null);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/users/me/permissions`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error('Permission lookup failed');
        const result = await response.json() as { data: { effectivePermissions: Permission[]; customPermissions: Permission[] } };
        setState({ token, permissions: result.data.effectivePermissions, customPermissions: result.data.customPermissions });
      } catch { if (!controller.signal.aborted) setState(null); }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [token]);
  return state?.token === token ? state : undefined;
}
