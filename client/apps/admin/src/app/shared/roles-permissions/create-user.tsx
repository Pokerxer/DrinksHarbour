// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { PiXBold } from 'react-icons/pi';
import { Controller, type SubmitHandler } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Form } from '@core/ui/form';
import {
  Input,
  Password,
  Button,
  ActionIcon,
  Title,
  Select,
  Text,
} from 'rizzui';
import {
  CreateUserInput,
  createUserSchema,
} from '@/validators/create-user.schema';
import { useModal } from '@/app/shared/modal-views/use-modal';
import {
  ASSIGNABLE_ROLES,
  TENANT_SCOPED_ROLES,
  createAdminUser,
} from '@/services/adminUser.service';
import { getAdminTenants, type AdminTenant } from '@/services/tenant.service';
import type { UserRole } from '@/types/authorization';

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

/**
 * Creates a user through POST /api/users (super-admin only). This replaced a
 * template stub that only console.logged the form; with public /signup removed,
 * this modal is the only way to create an admin.
 */
export default function CreateUser() {
  const { closeModal } = useModal();
  const { data: session } = useSession();
  const [reset, setReset] = useState({});
  const [isLoading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);

  const accessToken = (session?.user as { token?: string } | undefined)?.token;

  // Tenant-scoped roles need a tenant to attach to; load the list once so the
  // picker is ready when one of those roles is chosen.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    getAdminTenants(accessToken)
      .then((res) => {
        if (!cancelled) setTenants(res.tenants ?? []);
      })
      .catch(() => {
        /* non-blocking — the picker simply stays empty */
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const onSubmit: SubmitHandler<CreateUserInput> = async (data) => {
    setLoading(true);

    const result = await createAdminUser(
      {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        password: data.password,
        role: data.role as UserRole,
        tenant: data.tenant,
      },
      accessToken
    );

    setLoading(false);

    if (!result.success) {
      toast.error(result.message ?? 'Could not create the user.');
      return;
    }

    toast.success(`${data.firstName} ${data.lastName} can now sign in.`);
    setReset({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: '',
      tenant: '',
    });
    closeModal();
  };

  return (
    <Form<CreateUserInput>
      resetValues={reset}
      onSubmit={onSubmit}
      validationSchema={createUserSchema}
      className="grid grid-cols-1 gap-6 p-6 @container md:grid-cols-2 [&_.rizzui-input-label]:font-medium [&_.rizzui-input-label]:text-gray-900"
    >
      {({ register, control, watch, formState: { errors } }) => {
        const role = watch('role');
        const needsTenant = TENANT_SCOPED_ROLES.includes(role as never);

        return (
          <>
            <div className="col-span-full flex items-center justify-between">
              <Title as="h4" className="font-semibold">
                Add a new User
              </Title>
              <ActionIcon size="sm" variant="text" onClick={closeModal}>
                <PiXBold className="h-auto w-5" />
              </ActionIcon>
            </div>

            <Input
              label="First Name"
              placeholder="Ada"
              {...register('firstName')}
              error={errors.firstName?.message}
            />

            <Input
              label="Last Name"
              placeholder="Okoye"
              {...register('lastName')}
              error={errors.lastName?.message}
            />

            <Input
              label="Email"
              placeholder="Enter user's email address"
              className="col-span-full"
              {...register('email')}
              error={errors.email?.message}
            />

            <Password
              label="Temporary Password"
              placeholder="Set an initial password"
              className="col-span-full"
              {...register('password')}
              error={errors.password?.message}
              helperText="Share this with the user; they can change it after signing in."
            />

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
                  error={errors?.role?.message}
                  getOptionValue={(option) => option.value}
                  displayValue={(selected: string) =>
                    roleOptions.find((option) => option.value === selected)
                      ?.label ?? ''
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
                    options={tenants.map((t) => ({
                      label: t.name,
                      value: t._id,
                    }))}
                    value={value}
                    onChange={onChange}
                    name={name}
                    label="Tenant"
                    error={errors?.tenant?.message}
                    getOptionValue={(option) => option.value}
                    displayValue={(selected: string) =>
                      tenants.find((t) => t._id === selected)?.name ?? ''
                    }
                    dropdownClassName="!z-[1] h-auto"
                    inPortal={false}
                  />
                )}
              />
            )}

            <Text className="col-span-full -mt-2 text-sm text-gray-500">
              Permissions follow the role. New users are created active, with
              their email already verified.
            </Text>

            <div className="col-span-full flex items-center justify-end gap-4">
              <Button
                variant="outline"
                onClick={closeModal}
                className="w-full @xl:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full @xl:w-auto"
              >
                Create User
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
}
