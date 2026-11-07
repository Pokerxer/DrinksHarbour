'use client';
import { TenantProvider, useTenant } from './TenantContext';
import type { ErmStatus } from '@/services/erm.service';

/** Preserve branding while navigation supplies authenticated entitlements. */
export default function LiveErmTenant({ status, plan, children }: {
  status: ErmStatus; plan: string; children: React.ReactNode;
}) {
  const { tenant } = useTenant();
  return <TenantProvider initialTenant={tenant ? {
    ...tenant, plan, capabilities: status.capabilities,
    subscriptionStatus: status.subscriptionStatus,
    // Additive: the resolved industry profile the server applies (explicit
    // Tenant.industries first, then business-type derivation). Absent while the
    // flag is OFF or on older servers — consumers treat undefined as
    // unprofiled/legacy (no filtering).
    ...(status.industries ? { industries: status.industries } : {}),
  } : null}>{children}</TenantProvider>;
}
