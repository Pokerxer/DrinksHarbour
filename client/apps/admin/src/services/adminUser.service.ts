// services/adminUser.service.ts — administrative user management (platform)
//
// Backs the admin section of /api/users (`protect` + `authorize('admin',
// 'super_admin')` + requireMfa): creating a user, listing them, and
// suspend/activate. Tenant staff are NOT managed here — that is
// employee.service.ts against /api/employees.
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
  /** The call was refused for want of a recent MFA challenge — re-provable. */
  mfaRequired?: boolean;
}

/**
 * `requireMfa` refuses with one of two messages depending on whether the client
 * sent no proof or stale proof. Both mean the same thing to the caller: prompt
 * for a code and retry.
 */
function isMfaChallenge(message: string | undefined): boolean {
  if (!message) return false;
  return /mfa verification (required|\.)|re-verify|complete mfa/i.test(message);
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
  accessToken: string | undefined,
  mfaToken?: string
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
        // Proof of a recent MFA challenge; only sent when the session has one,
        // since an empty header would fail verification rather than be ignored.
        ...(mfaToken ? { 'x-mfa-token': mfaToken } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as CreateUserResponse;

    if (!response.ok || !data.success) {
      return {
        success: false,
        message: data.message || 'Could not create the user. Please try again.',
        mfaRequired: isMfaChallenge(data.message),
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

// ─── Listing & status management (roles-permissions users table) ─────────────

/** One row of GET /api/users. The server returns sanitized docs minus hashes. */
export interface AdminUserRow {
  _id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatar?: { url?: string } | null;
  role: UserRole;
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  tenant?:
    | string
    | { _id: string; name?: string; slug?: string }
    | null;
  customRole?: string | null;
  createdAt?: string;
}

export interface ListUsersParams {
  role?: UserRole;
  status?: AdminUserRow['status'];
  search?: string;
  page?: number;
  limit?: number;
}

interface ListUsersResponse {
  success?: boolean;
  data?: {
    users?: AdminUserRow[];
    pagination?: {
      currentPage: number;
      totalPages: number;
      totalResults: number;
    };
  };
  message?: string;
}

export interface AdminPagination {
  currentPage: number;
  totalPages: number;
  totalResults: number;
}

/**
 * GET /api/users with the service's supported filters. Returns the raw rows
 * plus pagination so callers can paginate client-side or follow the envelope.
 * Throws on failure — the caller is a table, not a modal.
 */
export async function listAdminUsers(
  params: ListUsersParams,
  accessToken: string
): Promise<{ users: AdminUserRow[]; pagination?: AdminPagination }> {
  const qs = new URLSearchParams();
  if (params.role) qs.set('role', params.role);
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));

  const response = await fetch(
    `${API_URL}/api/users${qs.toString() ? `?${qs}` : ''}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = (await response.json()) as ListUsersResponse;
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to load users');
  }
  return {
    users: data.data?.users ?? [],
    pagination: data.data?.pagination,
  };
}

async function setUserStatus(
  id: string,
  action: 'suspend' | 'activate',
  accessToken: string
): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`${API_URL}/api/users/${id}/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
  };
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Failed to ${action} the user`);
  }
  return { success: true };
}

export async function suspendAdminUser(id: string, accessToken: string) {
  return setUserStatus(id, 'suspend', accessToken);
}

export async function activateAdminUser(id: string, accessToken: string) {
  return setUserStatus(id, 'activate', accessToken);
}

/**
 * PUT /api/users/:id — generic field updates. Used here for assigning/clearing
 * a platform customRole (server validates scope and target eligibility).
 */
export async function updateAdminUser(
  id: string,
  patch: Record<string, unknown>,
  accessToken: string
): Promise<{ success?: boolean; message?: string }> {
  const response = await fetch(`${API_URL}/api/users/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(patch),
  });
  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
  };
  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Failed to update the user');
  }
  return data;
}

/** DELETE /api/users/:id — soft-delete (status → 'deleted'). */
export async function deleteAdminUser(
  id: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(`${API_URL}/api/users/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
  };
  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Failed to delete the user');
  }
}
