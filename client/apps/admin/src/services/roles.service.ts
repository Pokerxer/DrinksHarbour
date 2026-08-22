// services/roles.service.ts — custom access-control roles (/api/roles)
//
// Mirrors employee.service.ts's handle<T>/jsonAuth pattern. The server scopes
// every call by the caller (platform shelf vs own tenant), so no scope or
// tenant id is ever sent from here.
import type {
  CustomRole,
  Permission,
  PermissionCatalogEntry,
  RoleScope,
} from '@/types/authorization';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export type { CustomRole, RoleScope };

export interface GroupedCatalog {
  group: string;
  permissions: PermissionCatalogEntry[];
}

export interface CatalogResponse {
  success: boolean;
  data: {
    catalog: GroupedCatalog[];
    permissions: PermissionCatalogEntry[];
    platformOnly: string[];
  };
}

export interface RolesListResponse {
  success: boolean;
  data: { roles: CustomRole[] };
}

export interface RoleResponse {
  success: boolean;
  data: { role: CustomRole };
}

/** Payload for create/edit. `scope` is required on create only. */
export interface RoleInput {
  name: string;
  scope?: RoleScope;
  description?: string;
  color?: string;
  isActive?: boolean;
  permissions: Permission[];
}

async function handle<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || fallback);
  }
  return (await res.json()) as T;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonAuth = (token: string) => ({
  'Content-Type': 'application/json',
  ...auth(token),
});

export const rolesService = {
  async listRoles(token: string): Promise<RolesListResponse> {
    return handle(
      await fetch(`${API_URL}/api/roles`, { headers: auth(token) }),
      'Failed to load roles'
    );
  },

  async getCatalog(token: string): Promise<CatalogResponse> {
    return handle(
      await fetch(`${API_URL}/api/roles/permissions/catalog`, {
        headers: auth(token),
      }),
      'Failed to load the permission catalog'
    );
  },

  async createRole(
    input: RoleInput,
    token: string
  ): Promise<RoleResponse> {
    return handle(
      await fetch(`${API_URL}/api/roles`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to create the role'
    );
  },

  async updateRole(
    id: string,
    input: Partial<RoleInput>,
    token: string
  ): Promise<RoleResponse> {
    return handle(
      await fetch(`${API_URL}/api/roles/${id}`, {
        method: 'PUT',
        headers: jsonAuth(token),
        body: JSON.stringify(input),
      }),
      'Failed to update the role'
    );
  },

  async deleteRole(id: string, token: string): Promise<{ success: boolean }> {
    return handle(
      await fetch(`${API_URL}/api/roles/${id}`, {
        method: 'DELETE',
        headers: auth(token),
      }),
      'Failed to delete the role'
    );
  },
};
