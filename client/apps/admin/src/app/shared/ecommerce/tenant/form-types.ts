import type { AdminTenant, TenantOwner } from '@/services/tenant.service';

export type TenantFormMeta = Pick<
  AdminTenant,
  | 'name'
  | 'status'
  | 'kycVerified'
  | 'kycChecks'
  | 'kycWarnings'
  | 'kycNameCrossCheck'
  | 'location'
  | 'normalizedState'
> & { owner?: TenantOwner | null };
