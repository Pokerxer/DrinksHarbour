// services/adminUser.service.ts — administrative user creation
//
// Backs POST /api/users (`protect` + `authorize('super_admin')`), the endpoint
// added in Part 0 of the auth overhaul. It is the only way to create an admin
// now that public /signup is gone: public registration always yields a
// `customer`, whatever role the caller asks for.
import type { UserRole } from '@/types/authorization';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/** Roles an administrator can hand out from the dashboard. */
export const ASSIGNABLE_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'tenant_admin',
  'tenant_owner',
  'tenant_staff',
];

/** Roles that are meaningless without a tenant to scope them to. */
export const TENANT_SCOPED_ROLES: UserRole[] = [
  'tenant_admin',
  'tenant_owner',
  'tenant_staff',
];

export interface CreateAdminUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  tenant?: string;
  phoneNumber?: string;
}

export interface CreatedUser {
  _id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

export interface CreateAdminUserResult {
  success: boolean;
  user?: CreatedUser;
  message?: string;
}

interface CreateUserResponse {
  success?: boolean;
  message?: string;
  data?: { user?: CreatedUser };
}

/**
 * Create a user with an elevated role.
 *
 * Never throws: the caller is a modal that needs a message to show, not an
 * exception to catch.
 */
export async function createAdminUser(
  input: CreateAdminUserInput,
  accessToken: string | undefined
): Promise<CreateAdminUserResult> {
  if (!accessToken) {
    return {
      success: false,
      message: 'Your session has expired. Please sign in again.',
    };
  }

  // An empty tenant would fail `isMongoId()` validation; absent is the correct
  // representation of "no tenant".
  const { tenant, phoneNumber, ...rest } = input;
  const payload: Record<string, unknown> = { ...rest };
  if (tenant) payload.tenant = tenant;
  if (phoneNumber) payload.phoneNumber = phoneNumber;

  try {
    const response = await fetch(`${API_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as CreateUserResponse;

    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || 'Could not create the user. Please try again.',
      };
    }

    return { success: true, user: data.data?.user };
  } catch (error) {
    console.error('Failed to create user:', error);
    return {
      success: false,
      message: 'Unable to reach the server. Please check your connection.',
    };
  }
}
