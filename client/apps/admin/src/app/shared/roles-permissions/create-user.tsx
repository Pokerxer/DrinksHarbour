// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { PiXBold } from 'react-icons/pi';
import { type SubmitHandler } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Form } from '@core/ui/form';
import {
  Input,
  Password,
  Button,
  ActionIcon,
  Title,
  Text,
} from 'rizzui';
import {
  CreateUserInput,
  createUserSchema,
} from '@/validators/create-user.schema';
import { useModal } from '@/app/shared/modal-views/use-modal';
import {
  TENANT_SCOPED_ROLES,
  createAdminUser,
} from '@/services/adminUser.service';
import { getAdminTenants, type AdminTenant } from '@/services/tenant.service';
import { stepUpMfa } from '@/services/mfa.service';
import type { UserRole } from '@/types/authorization';
import {
  resolveCreateUserAssignment,
  type FixedUserAssignment,
} from './create-user-assignment';
import { CreateUserAssignmentFields } from './create-user-assignment-fields';

/**
 * Creates a user through POST /api/users (super-admin only). This replaced a
 * template stub that only console.logged the form; with public /signup removed,
 * this modal is the only way to create an admin.
 */
type CreateUserProps = {
  fixedAssignment?: FixedUserAssignment;
  title?: string;
};

function emptyUserForm(fixedAssignment?: FixedUserAssignment): CreateUserInput {
  return {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: fixedAssignment?.role ?? '',
    tenant: fixedAssignment?.tenantId ?? '',
  };
}

export default function CreateUser({
  fixedAssignment,
  title = 'Add a new User',
}: CreateUserProps = {}) {
  const { closeModal } = useModal();
  const { data: session, update: updateSession } = useSession();
  const [reset, setReset] = useState<CreateUserInput>(() =>
    emptyUserForm(fixedAssignment)
  );
  const [isLoading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  // Set when the API refuses for want of a recent MFA challenge; holds the
  // submitted values so the create can be retried once the code is accepted.
  const [pendingMfa, setPendingMfa] = useState<CreateUserInput | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);

  const sessionUser = session?.user as
    | { token?: string; mfaToken?: string }
    | undefined;
  const accessToken = sessionUser?.token;

  // Tenant-scoped roles need a tenant to attach to; load the list once so the
  // picker is ready when one of those roles is chosen.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    if (fixedAssignment?.tenantId) return;
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
  }, [accessToken, fixedAssignment?.tenantId]);

  const submit = async (data: CreateUserInput, mfaToken?: string) => {
    setLoading(true);

    const assignment = resolveCreateUserAssignment(
      { role: data.role, tenant: data.tenant },
      fixedAssignment
    );

    const result = await createAdminUser(
      {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        password: data.password,
        role: assignment.role as UserRole,
        tenant: assignment.tenant,
      },
      accessToken,
      mfaToken ?? sessionUser?.mfaToken
    );

    setLoading(false);

    if (result.mfaRequired) {
      // Proof of MFA lasts 10 minutes; this session's has lapsed (or the admin
      // enabled MFA after signing in). Re-prove rather than lose the form.
      setPendingMfa(data);
      setMfaCode('');
      setMfaError(null);
      return;
    }

    if (!result.success) {
      toast.error(result.message ?? 'Could not create the user.');
      return;
    }

    toast.success(`${data.firstName} ${data.lastName} can now sign in.`);
    setPendingMfa(null);
    setReset(emptyUserForm(fixedAssignment));
    closeModal();
  };

  const onSubmit: SubmitHandler<CreateUserInput> = (data) => submit(data);

  const onVerifyMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingMfa || !mfaCode.trim()) return;

    setLoading(true);
    const result = await stepUpMfa(mfaCode.trim(), accessToken);
    setLoading(false);

    if (!result.success || !result.mfaToken) {
      setMfaCode('');
      setMfaError(result.message ?? 'That code was not accepted.');
      return;
    }

    // Push the fresh token into the JWT so later privileged calls carry it too;
    // pass it straight to the retry rather than waiting for the session to
    // round-trip.
    await updateSession({ mfaToken: result.mfaToken });
    const data = pendingMfa;
    setPendingMfa(null);
    await submit(data, result.mfaToken);
  };

  if (pendingMfa) {
    return (
      <form onSubmit={onVerifyMfa} className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <Title as="h4" className="font-semibold text-gray-900 dark:text-white">
            Confirm it&apos;s you
          </Title>
          <ActionIcon size="sm" variant="text" onClick={closeModal}>
            <PiXBold className="h-auto w-5" />
          </ActionIcon>
        </div>
        <Text className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Creating a user needs a recent two-factor check. Enter the current
          code from your authenticator app — or a backup code — and we&apos;ll
          finish creating {pendingMfa.firstName} {pendingMfa.lastName}.
        </Text>
        <Input
          label="Verification code"
          placeholder="000000"
          autoFocus
          autoComplete="one-time-code"
          value={mfaCode}
          onChange={(e) => setMfaCode(e.target.value)}
          error={mfaError ?? undefined}
        />
        <div className="mt-6 flex items-center justify-end gap-4">
          <Button
            variant="outline"
            onClick={() => setPendingMfa(null)}
            className="w-full @xl:w-auto"
          >
            Back
          </Button>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={isLoading || !mfaCode.trim()}
            className="w-full @xl:w-auto"
          >
            Verify and create
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Form<CreateUserInput>
      resetValues={reset}
      useFormProps={{ defaultValues: reset }}
      onSubmit={onSubmit}
      validationSchema={createUserSchema}
      className="grid grid-cols-1 gap-6 p-6 @container md:grid-cols-2 [&_.rizzui-input-label]:font-medium [&_.rizzui-input-label]:text-gray-900 dark:[&_.rizzui-input-label]:text-gray-200"
    >
      {({ register, control, watch, formState: { errors } }) => {
        const role = fixedAssignment?.role ?? watch('role');
        const needsTenant = TENANT_SCOPED_ROLES.includes(role as never);

        return (
          <>
            <div className="col-span-full flex items-center justify-between">
              <Title as="h4" className="font-semibold text-gray-900 dark:text-white">
                {title}
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

            <Password
              label="Confirm Temporary Password"
              placeholder="Enter the password again"
              className="col-span-full"
              {...register('confirmPassword')}
              error={errors.confirmPassword?.message}
            />

            <CreateUserAssignmentFields
              control={control}
              errors={errors}
              fixedAssignment={fixedAssignment}
              needsTenant={needsTenant}
              tenants={tenants}
            />

            <Text className="col-span-full -mt-2 text-sm text-gray-500 dark:text-gray-400">
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
                {fixedAssignment ? 'Create Login' : 'Create User'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
}
