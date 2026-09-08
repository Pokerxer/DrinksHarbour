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
  } : null}>{children}</TenantProvider>;
}
