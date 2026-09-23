'use client';

import {
  PiCheckCircleBold,
  PiKeyBold,
  PiPlusBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import { Badge, Button, Text } from 'rizzui';

import { useModal } from '@/app/shared/modal-views/use-modal';
import CreateUser from '@/app/shared/roles-permissions/create-user';

import { Card } from './form-controls';
import type { TenantFormMeta } from './form-types';
import { TenantBrandTheme } from './tenant-brand-theme';

type TenantAccessCardsProps = {
  tenantId: string;
  tenantName: string;
  meta?: TenantFormMeta;
};

export function TenantAccessCards({
  tenantId,
  tenantName,
  meta,
}: TenantAccessCardsProps) {
  const { openModal } = useModal();

  return (
    <>
      <Card title="Owner Account">
        {meta?.owner ? (
          <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
            <PiCheckCircleBold className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <div className="min-w-0">
              <Text className="text-sm font-medium text-gray-800 dark:text-gray-100">
                {meta.owner.displayName ||
                  [meta.owner.firstName, meta.owner.lastName]
                    .filter(Boolean)
                    .join(' ') ||
                  meta.owner.email}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {meta.owner.email}
              </Text>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {meta.owner.role && (
                  <Badge
                    variant="flat"
                    color="secondary"
                    className="text-xs capitalize"
                  >
                    {String(meta.owner.role).replace(/_/g, ' ')}
                  </Badge>
                )}
                {meta.owner.status && (
                  <Badge
                    variant="flat"
                    color={meta.owner.status === 'active' ? 'success' : 'warning'}
                    className="text-xs capitalize"
                  >
                    {meta.owner.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:border-orange-900 dark:bg-orange-950/30">
            <PiWarningCircleBold className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
            <div>
              <Text className="text-sm font-medium text-orange-900 dark:text-orange-200">
                No owner account
              </Text>
              <Text className="text-xs text-orange-700 dark:text-orange-300">
                Nobody can sign in as the owner. Create a tenant_owner user from
                the Users page and assign them to this tenant.
              </Text>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Tenant Admin Login"
        description="Create an administrator who can sign in and manage this tenant. The account is permanently scoped to this tenant."
      >
        {meta?.status === 'approved' ? (
          <div className="flex flex-col gap-4 rounded-xl border border-red-100 bg-red-50/60 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-red-900 dark:bg-red-950/30">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300">
                <PiKeyBold className="h-5 w-5" />
              </span>
              <div>
                <Text className="font-medium text-gray-900 dark:text-white">
                  Add tenant administrator
                </Text>
                <Text className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                  Set their name, email, and temporary login password.
                </Text>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full shrink-0 sm:w-auto"
              onClick={() =>
                openModal({
                  size: 'lg',
                  view: (
                    <TenantBrandTheme>
                      <CreateUser
                        title="Create Tenant Admin Login"
                        fixedAssignment={{
                          role: 'tenant_admin',
                          tenantId,
                          tenantName: meta.name || tenantName,
                        }}
                      />
                    </TenantBrandTheme>
                  ),
                })
              }
            >
              <PiPlusBold className="me-1.5 h-4 w-4" />
              Create Login
            </Button>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30">
            <PiWarningCircleBold className="mt-0.5 h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
            <div>
              <Text className="font-medium text-orange-900 dark:text-orange-200">
                Approve this tenant first
              </Text>
              <Text className="mt-1 text-sm text-orange-700 dark:text-orange-300">
                Save the tenant with Approved status before creating an
                administrator login.
              </Text>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
