import type { UserRole } from '@/types/authorization';

export type FixedUserAssignment = {
  role: UserRole;
  tenantId?: string;
  tenantName?: string;
};

type SelectedAssignment = {
  role: string;
  tenant?: string;
};

/**
 * A tenant edit page owns the role and tenant assignment. Resolve those fixed
 * values at submission time so altered or stale form state cannot create an
 * account outside the tenant the operator is viewing.
 */
export function resolveCreateUserAssignment(
  selected: SelectedAssignment,
  fixed?: FixedUserAssignment
): SelectedAssignment {
  if (!fixed) return selected;

  return {
    role: fixed.role,
    tenant: fixed.tenantId,
  };
}
