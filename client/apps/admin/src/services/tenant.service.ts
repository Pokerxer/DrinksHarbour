// @ts-nocheck
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface AdminTenant {
  _id: string;
  name: string;
  slug: string;
  plan: string;
  subscriptionStatus: string;
  status: string;
  revenueModel: string;
  markupPercentage?: number;
  commissionPercentage?: number;
  platformMarkupPercentage?: number;
  packMarkupPercentage?: number | null;
  packCommissionPercentage?: number | null;
  packRateMinUnits?: number;
  logo?: { url: string; alt?: string };
  primaryColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  country?: string;
  isSystemTenant?: boolean;
  createdAt: string;
  // full detail fields (from getAdminTenantById)
  customPricingNote?: string;
  defaultCurrency?: string;
  supportedCurrencies?: string[];
  address?: {
    street?: string;
    city?: string;
    lga?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  enforceAgeVerification?: boolean;
  rejectionReason?: string;
  notes?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  purchaseSettings?: {
    billControlPolicy?: string;
    enable3WayMatching?: boolean;
    requirePOApproval?: boolean;
    approvalThreshold?: number;
    defaultPaymentTerms?: string;
    autoGenerateBill?: boolean;
    allowPartialReceipts?: boolean;
    defaultReceivingLocation?: string;
  };
}

export interface TenantFormData {
  name: string;
  slug: string;
  contactEmail?: string;
  contactPhone?: string;
  primaryColor?: string;
  plan?: string;
  subscriptionStatus?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  revenueModel?: string;
  markupPercentage?: number;
  commissionPercentage?: number;
  platformMarkupPercentage?: number;
  packMarkupPercentage?: number | '';
  packCommissionPercentage?: number | '';
  packRateMinUnits?: number | '';
  customPricingNote?: string;
  defaultCurrency?: string;
  supportedCurrencies?: string;
  country?: string;
  addressStreet?: string;
  addressCity?: string;
  addressLga?: string;
  addressState?: string;
  addressZipCode?: string;
  addressCountry?: string;
  enforceAgeVerification?: boolean;
  isSystemTenant?: boolean;
  status?: string;
  rejectionReason?: string;
  notes?: string;
  // Purchase Settings
  psBillControlPolicy?: string;
  psEnable3WayMatching?: boolean;
  psRequirePOApproval?: boolean;
  psApprovalThreshold?: number;
  psDefaultPaymentTerms?: string;
  psAutoGenerateBill?: boolean;
  psAllowPartialReceipts?: boolean;
  psDefaultReceivingLocation?: string;
  // image
  logoFile?: File | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function buildTenantFormData(data: TenantFormData): FormData {
  const form = new FormData();
  Object.entries(data).forEach(([k, v]) => {
    if (k === 'logoFile') {
      if (v instanceof File) form.append('logo', v);
    } else if (v !== undefined && v !== null) {
      form.append(k, String(v));
    }
  });
  return form;
}

async function apiFetch<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Request failed');
  return json.data;
}

export async function getAdminTenants(token: string): Promise<{ tenants: AdminTenant[]; total: number }> {
  return apiFetch(`${API_URL}/api/tenants/admin`, { headers: authHeaders(token) });
}

export async function getAdminTenantById(token: string, id: string): Promise<{ tenant: AdminTenant }> {
  return apiFetch(`${API_URL}/api/tenants/admin/${id}`, { headers: authHeaders(token) });
}

export async function createAdminTenant(token: string, data: TenantFormData): Promise<{ tenant: AdminTenant }> {
  return apiFetch(`${API_URL}/api/tenants/admin`, {
    method: 'POST',
    headers: authHeaders(token),
    body: buildTenantFormData(data),
  });
}

export async function updateAdminTenant(token: string, id: string, data: TenantFormData): Promise<{ tenant: AdminTenant }> {
  return apiFetch(`${API_URL}/api/tenants/admin/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: buildTenantFormData(data),
  });
}

export async function deleteAdminTenant(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/tenants/admin/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Delete failed');
}
