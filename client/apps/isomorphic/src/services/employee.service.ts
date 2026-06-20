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

export type Gender = 'male' | 'female' | 'other' | '';
export type MaritalStatus =
  | 'single'
  | 'married'
  | 'divorced'
  | 'widowed'
  | 'cohabitant'
  | '';

export interface BankAccount {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
}

/** Odoo-style HR profile. Every section is optional. */
export interface EmployeeProfile {
  privateContact?: {
    email?: string;
    phone?: string;
    bankAccounts?: BankAccount[];
  };
  personal?: {
    legalName?: string;
    birthday?: string | null;
    placeOfBirthCity?: string;
    placeOfBirthCountry?: string;
    gender?: Gender;
    payslipLanguage?: string;
  };
  emergencyContact?: { name?: string; phone?: string };
  visaWorkPermit?: {
    visaNo?: string;
    workPermitNo?: string;
    documentUrl?: string;
  };
  citizenship?: {
    nationality?: string;
    nonResident?: boolean;
    identificationNo?: string;
    ssnNo?: string;
    passportNo?: string;
  };
  location?: {
    address?: {
      street?: string;
      street2?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
    homeWorkDistanceKm?: number;
  };
  family?: { maritalStatus?: MaritalStatus; dependentChildren?: number };
  education?: { certificateLevel?: string; fieldOfStudy?: string };
  documents?: {
    idCardUrl?: string;
    drivingLicenseUrl?: string;
    simCardUrl?: string;
    internetInvoiceUrl?: string;
  };
  appraisal?: { nextAppraisalDate?: string | null };
  approvers?: { hrResponsible?: string; expense?: string; timeOff?: string };
  planning?: { roles?: string[]; defaultRole?: string };
  appSettings?: { analyticDistribution?: string; hourlyCost?: number };
  attendance?: { rfidBadge?: string };
  work?: {
    department?: string;
    jobPosition?: string;
    jobTitle?: string;
    /** Employee `_id` of this person's manager. */
    manager?: string;
    workAddress?: {
      company?: string;
      street?: string;
      street2?: string;
      city?: string;
      zip?: string;
      country?: string;
    };
    workLocation?: string;
    note?: string;
  };
  timezone?: string;
}

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
  employeeProfile?: EmployeeProfile;
  createdAt: string;
}

/** Avatar payload sent to the API. `null` clears the stored photo. */
export interface AvatarInput {
  url?: string;
  publicId?: string;
}

export interface EmployeeInput {
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  /** Profile photo. Send `null` to remove the current one. */
  avatar?: AvatarInput | null;
  role: 'tenant_admin' | 'tenant_staff';
  status: EmployeeStatus;
  posAccess: boolean;
  posName?: string;
  posPermissions?: PosPermission[];
  /** 4–6 digit PIN. Omit to leave unchanged; '' or null clears it on update. */
  pin?: string | null;
  employeeProfile?: EmployeeProfile;
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

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: '', label: '—' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const MARITAL_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: '', label: '—' },
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'cohabitant', label: 'Cohabitant' },
];

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

  async getEmployeeById(
    id: string,
    token: string
  ): Promise<{ success: boolean; data: { employee: Employee } }> {
    return handle(
      await fetch(`${API_URL}/api/employees/${id}`, { headers: auth(token) }),
      'Failed to load employee'
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
