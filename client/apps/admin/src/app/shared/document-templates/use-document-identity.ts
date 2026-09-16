'use client';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTenant } from '@/context/TenantContext';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
export function useDocumentIdentity() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { tenant: adminTenant } = useTenant();
  const pos = usePOSAuth();
  const user = session?.user as { token?: string; tenantId?: string } | undefined;
  const isPOS = Boolean(
    pos.token &&
      (pathname === '/pos' ||
        pathname?.startsWith('/pos/') ||
        pathname === '/point-of-sale' ||
        pathname?.startsWith('/point-of-sale/'))
  );
  const token = (isPOS ? pos.token : user?.token) || '';
  const tenant = isPOS ? pos.tenant : adminTenant;
  const tenantId = tenant?._id || (!isPOS ? user?.tenantId : '');
  return {
    token,
    tenant,
    isPOS,
    hasTenant: Boolean(tenantId),
    status: isPOS ? 'authenticated' : status,
    scope: `${isPOS ? 'pos' : 'admin'}:${token}:${tenantId}:${tenant?.slug}`,
  };
}
