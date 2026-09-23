'use client';

import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Select, Text } from 'rizzui';

import type { AdminTenant } from '@/services/tenant.service';
import { ASSIGNABLE_ROLES } from '@/services/adminUser.service';
import type { CreateUserInput } from '@/validators/create-user.schema';

import type { FixedUserAssignment } from './create-user-assignment';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  tenant_admin: 'Tenant Admin',
  tenant_owner: 'Tenant Owner',
  tenant_staff: 'Tenant Staff',
};

const roleOptions = ASSIGNABLE_ROLES.map((role) => ({
  label: ROLE_LABELS[role] ?? role,
  value: role,
}));

type CreateUserAssignmentFieldsProps = {
  control: Control<CreateUserInput>;
  errors: FieldErrors<CreateUserInput>;
  fixedAssignment?: FixedUserAssignment;
  needsTenant: boolean;
  tenants: AdminTenant[];
};

export function CreateUserAssignmentFields({
  control,
  errors,
  fixedAssignment,
  needsTenant,
  tenants,
}: CreateUserAssignmentFieldsProps) {
  if (fixedAssignment) {
    return (
      <div className="col-span-full grid gap-3 rounded-xl border border-red-100 bg-red-50/60 p-4 sm:grid-cols-2 dark:border-red-900 dark:bg-red-950/30">
        <div>
          <Text className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-300">
            Role
          </Text>
          <Text className="mt-1 font-medium text-gray-900 dark:text-white">
            {ROLE_LABELS[fixedAssignment.role] ?? fixedAssignment.role}
          </Text>
        </div>
        <div>
          <Text className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-300">
            Tenant
          </Text>
          <Text className="mt-1 font-medium text-gray-900 dark:text-white">
            {fixedAssignment.tenantName ?? 'Current tenant'}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <>
      <Controller
        name="role"
        control={control}
        render={({ field: { name, onChange, value } }) => (
          <Select
            options={roleOptions}
            value={value}
            onChange={onChange}
            name={name}
            label="Role"
            className={needsTenant ? '' : 'col-span-full'}
            error={errors.role?.message}
            getOptionValue={(option) => option.value}
            displayValue={(selected: string) =>
              roleOptions.find((option) => option.value === selected)?.label ??
              ''
            }
            dropdownClassName="!z-[1]"
            inPortal={false}
          />
        )}
      />

      {needsTenant && (
        <Controller
          name="tenant"
          control={control}
          render={({ field: { name, onChange, value } }) => (
            <Select
              options={tenants.map((tenant) => ({
                label: tenant.name,
                value: tenant._id,
              }))}
              value={value}
              onChange={onChange}
              name={name}
              label="Tenant"
              error={errors.tenant?.message}
              getOptionValue={(option) => option.value}
              displayValue={(selected: string) =>
                tenants.find((tenant) => tenant._id === selected)?.name ?? ''
              }
              dropdownClassName="!z-[1] h-auto"
              inPortal={false}
            />
          )}
        />
      )}
    </>
  );
}
