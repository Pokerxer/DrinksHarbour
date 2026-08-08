// services/orgStructure.service.ts — tenant org structure: departments, job
// positions and HR/planning employee roles.
//
// These three entities share a surface (list / get / create / update / delete
// under a tenant), so one generic client is built per entity rather than three
// near-identical modules.
//
// Note: `EmployeeRole` here is an HR/planning role (Cashier, Bartender, Driver)
// used to staff shifts. It is NOT the access-control role on Employee — that
// stays the fixed `tenant_owner | tenant_admin | tenant_staff` enum and lives in
// employee.service.ts.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'intern',
  'temporary',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  intern: 'Intern',
  temporary: 'Temporary',
};

/** A ref the API may return as a bare id, a populated document, or null. */
export type Ref<T> = string | T | null | undefined;

export interface PersonRef {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: { url?: string } | string;
}

interface OrgEntityBase {
  _id: string;
  name: string;
  color?: string;
  note?: string;
  isActive: boolean;
  /** Live employees pointing at this record. Server-computed, one aggregate. */
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Department extends OrgEntityBase {
  code?: string;
  parent?: Ref<{ _id: string; name: string }>;
  /** The "selected admin": reviews this department's appraisals. */
  manager?: Ref<PersonRef>;
}

export interface JobPosition extends OrgEntityBase {
  department?: Ref<{ _id: string; name: string; color?: string }>;
  employmentType: EmploymentType;
  expectedHeadcount: number;
  description?: string;
  requirements?: string;
}

export interface EmployeeRole extends OrgEntityBase {
  hourlyCost: number;
}

export interface DepartmentInput {
  name: string;
  code?: string;
  parent?: string | null;
  manager?: string | null;
  color?: string;
  note?: string;
  isActive?: boolean;
}

export interface JobPositionInput {
  name: string;
  department?: string | null;
  employmentType?: EmploymentType;
  expectedHeadcount?: number;
  description?: string;
  requirements?: string;
  color?: string;
  note?: string;
  isActive?: boolean;
}

export interface EmployeeRoleInput {
  name: string;
  hourlyCost?: number;
  color?: string;
  note?: string;
  isActive?: boolean;
}

export interface OrgListParams {
  search?: string;
  /** Omit for both active and inactive — an admin has to see what to reactivate. */
  isActive?: boolean;
  /** Job positions only. */
  department?: string;
}

/**
 * Read a ref that may be an id, a populated document, or null.
 *
 * A dangling ref populates as `null`, and `typeof null === 'object'` — narrowing
 * on that alone is what blanked the warehouse pages. Every read of a ref goes
 * through here.
 */
export function refId(ref: Ref<{ _id: string }>): string {
  if (!ref) return '';
  return typeof ref === 'string' ? ref : String(ref._id ?? '');
}

/** Display name of a populated ref; '' when it is a bare id or missing. */
export function refName(ref: Ref<{ name?: string }>): string {
  if (!ref || typeof ref === 'string') return '';
  return ref.name ?? '';
}

/** The API's envelope. `res.json()` is `unknown` under this tsconfig. */
interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

async function handle<T>(
  res: Response,
  fallback: string
): Promise<ApiEnvelope<T>> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || fallback);
  }
  return (await res.json()) as ApiEnvelope<T>;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const jsonAuth = (token: string) => ({
  'Content-Type': 'application/json',
  ...auth(token),
});

function query(params?: OrgListParams) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.isActive !== undefined)
    qs.set('isActive', String(params.isActive));
  if (params?.department) qs.set('department', params.department);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/**
 * Build the five-call client for one org entity.
 * @param path - the API segment, e.g. 'departments'
 */
function makeClient<T, TInput>(path: string, noun: string) {
  const base = `${API_URL}/api/${path}`;
  return {
    async list(token: string, params?: OrgListParams): Promise<T[]> {
      const json = await handle<{ items: T[] }>(
        await fetch(`${base}${query(params)}`, { headers: auth(token) }),
        `Failed to load ${noun}`
      );
      return json.data.items;
    },

    async get(id: string, token: string): Promise<T> {
      const json = await handle<{ item: T }>(
        await fetch(`${base}/${id}`, { headers: auth(token) }),
        `Failed to load ${noun}`
      );
      return json.data.item;
    },

    async create(input: TInput, token: string): Promise<T> {
      const json = await handle<{ item: T }>(
        await fetch(base, {
          method: 'POST',
          headers: jsonAuth(token),
          body: JSON.stringify(input),
        }),
        `Failed to create ${noun}`
      );
      return json.data.item;
    },

    async update(
      id: string,
      input: Partial<TInput>,
      token: string
    ): Promise<T> {
      const json = await handle<{ item: T }>(
        await fetch(`${base}/${id}`, {
          method: 'PATCH',
          headers: jsonAuth(token),
          body: JSON.stringify(input),
        }),
        `Failed to update ${noun}`
      );
      return json.data.item;
    },

    /**
     * Delete. The API refuses with 409 while employees, positions or
     * sub-departments still reference the record; the thrown message names the
     * counts and says to deactivate instead, so surface it verbatim.
     */
    async remove(id: string, token: string): Promise<void> {
      await handle<unknown>(
        await fetch(`${base}/${id}`, {
          method: 'DELETE',
          headers: auth(token),
        }),
        `Failed to delete ${noun}`
      );
    },
  };
}

export const departmentService = makeClient<Department, DepartmentInput>(
  'departments',
  'departments'
);
export const jobPositionService = makeClient<JobPosition, JobPositionInput>(
  'job-positions',
  'job positions'
);
export const employeeRoleService = makeClient<EmployeeRole, EmployeeRoleInput>(
  'employee-roles',
  'roles'
);
