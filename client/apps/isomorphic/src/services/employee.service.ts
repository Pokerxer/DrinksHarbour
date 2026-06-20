// services/employee.service.ts — tenant staff management
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export type EmployeeRole = 'tenant_owner' | 'tenant_admin' | 'tenant_staff';
export type EmployeeStatus = 'active' | 'inactive' | 'suspended';

export const POS_PERMISSIONS = [
  'pos:sell',
  'pos:refund',
  'pos:void',
  'pos:price_override',
  'pos:discount',
  'pos:terminal:retail',
  'pos:terminal:wholesale',
] as const;
export type PosPermission = (typeof POS_PERMISSIONS)[number];

export interface Employee {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  posAccess: boolean;
  posName: string;
  posPermissions: PosPermission[];
  /** True when a POS PIN is set (the hash itself is never returned). */
  hasPin: boolean;
  createdAt: string;
}

export interface EmployeeInput {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  role: 'tenant_admin' | 'tenant_staff';
  status: EmployeeStatus;
  posAccess: boolean;
  posName?: string;
  posPermissions?: PosPermission[];
  /** 4–6 digit PIN. Omit to leave unchanged; '' or null clears it on update. */
  pin?: string | null;
}

export interface EmployeeListParams {
  role?: EmployeeRole;
  status?: EmployeeStatus;
  search?: string;
}

async function handle(res: Response, fallback: string) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || fallback);
  }
  return res.json();
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonAuth = (token: string) => ({
  'Content-Type': 'application/json',
  ...auth(token),
});

export const employeeService = {
  async getEmployees(
    token: string,
    params?: EmployeeListParams
  ): Promise<{ success: boolean; data: { employees: Employee[] } }> {
    const qs = new URLSearchParams();
    if (params?.role) qs.set('role', params.role);
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const url = `${API_URL}/api/employees${qs.toString() ? `?${qs}` : ''}`;
    return handle(
      await fetch(url, { headers: auth(token) }),
      'Failed to load employees'
    );
  },

  async createEmployee(
    data: EmployeeInput,
    token: string
  ): Promise<{ success: boolean; data: { employee: Employee } }> {
    return handle(
      await fetch(`${API_URL}/api/employees`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify(data),
      }),
      'Failed to create employee'
    );
  },

  async updateEmployee(
    id: string,
    data: Partial<EmployeeInput>,
    token: string
  ): Promise<{ success: boolean; data: { employee: Employee } }> {
    return handle(
      await fetch(`${API_URL}/api/employees/${id}`, {
        method: 'PATCH',
        headers: jsonAuth(token),
        body: JSON.stringify(data),
      }),
      'Failed to update employee'
    );
  },

  async removeEmployee(
    id: string,
    token: string
  ): Promise<{ success: boolean; message: string }> {
    return handle(
      await fetch(`${API_URL}/api/employees/${id}`, {
        method: 'DELETE',
        headers: auth(token),
      }),
      'Failed to remove employee'
    );
  },

  async setPin(
    id: string,
    pin: string,
    token: string
  ): Promise<{ success: boolean; data: { employee: Employee } }> {
    return handle(
      await fetch(`${API_URL}/api/employees/${id}/pin`, {
        method: 'POST',
        headers: jsonAuth(token),
        body: JSON.stringify({ pin }),
      }),
      'Failed to set PIN'
    );
  },

  async resetPin(
    id: string,
    token: string
  ): Promise<{ success: boolean; data: { employee: Employee } }> {
    return handle(
      await fetch(`${API_URL}/api/employees/${id}/pin`, {
        method: 'DELETE',
        headers: auth(token),
      }),
      'Failed to reset PIN'
    );
  },
};
