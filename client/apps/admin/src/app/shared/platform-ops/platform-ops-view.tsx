'use client';
// Platform-operations view: super-admin-only surface that mounts the read-only
// exceptions queue and readiness snapshot. Separate from merchant action screens.
import { useAuthorization } from '@/hooks/use-authorization';
import OperationsQueue from './operations-queue';
import OperationsMechanismsQueue from './operations-mechanisms-queue';
import PolicyRegistryPanel from './policy-registry-panel';
import ReadinessPanel from './readiness-panel';
import { ledgerProseSoft } from '../merchant-orders/design-tokens';

export default function PlatformOpsView() {
  const { user, role } = useAuthorization();
  if (!['super_admin', 'admin'].includes(role))
    return <p role="note">Platform operations access required.</p>;
  if (!user?.token)
    return <p role="note">Sign in to review platform operations.</p>;
  return (
    <div className="space-y-5">
      {/* Quiet document stamp above the register panels — no card chrome */}
      <header>
        <h1 className="text-xl font-semibold leading-7 tracking-tight text-gray-900 dark:text-gray-100">
          Platform operations
        </h1>
        <p className={`${ledgerProseSoft} mt-1 max-w-2xl`}>
          Read-only operational exceptions and reviewed readiness evidence.
          Readiness evidence is not activation permission.
        </p>
      </header>
      <OperationsQueue token={user.token} role={role} />
      <OperationsMechanismsQueue token={user.token} role={role} />
      <PolicyRegistryPanel token={user.token} role={role} />
      <ReadinessPanel token={user.token} role={role} />
    </div>
  );
}
